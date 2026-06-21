import { supabase, supabaseAdmin } from '../config/supabaseClient.js';
import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

// Helper to fetch report data
const fetchReportData = async (userId, groupId, startDate, endDate) => {
  // Get active groups of user to secure query
  const { data: memberships } = await supabaseAdmin
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  
  const userGroupIds = memberships ? memberships.map(m => m.group_id) : [];

  if (groupId && !userGroupIds.includes(groupId)) {
    throw new Error('Access Denied. You are not a member of this group.');
  }

  // Build query for expenses
  let query = supabaseAdmin
    .from('expenses')
    .select('*')
    .in('group_id', groupId ? [groupId] : userGroupIds);

  if (startDate) {
    query = query.gte('expense_date', startDate);
  }
  if (endDate) {
    query = query.lte('expense_date', endDate);
  }

  const { data: expenses, error: expError } = await query.order('expense_date', { ascending: false });
  if (expError) throw expError;

  if (expenses.length === 0) {
    return { expenses: [], splits: [], groupName: groupId ? 'Group Report' : 'All Groups' };
  }

  // Fetch splits for these expenses
  const expenseIds = expenses.map(e => e.id);
  const { data: splits, error: splitsError } = await supabaseAdmin
    .from('expense_splits')
    .select('*, profiles(full_name, email)')
    .in('expense_id', expenseIds);

  if (splitsError) throw splitsError;

  let groupName = 'All Groups';
  if (groupId) {
    const { data: group } = await supabaseAdmin.from('groups').select('name').eq('id', groupId).single();
    if (group) groupName = group.name;
  }

  return { expenses, splits, groupName };
};

// Summary analytics
export const getSummary = async (req, res) => {
  const userId = req.user.id;
  const { group_id, start_date, end_date } = req.query;

  try {
    const { expenses, splits } = await fetchReportData(userId, group_id, start_date, end_date);

    // Calculations
    let totalSpend = 0;
    let userShare = 0;
    const categoryBreakdown = {};
    const monthlySpending = {};

    expenses.forEach(e => {
      totalSpend += parseFloat(e.amount);
      
      // Category Breakdown
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + parseFloat(e.amount);

      // Monthly Spending (YYYY-MM)
      const month = new Date(e.expense_date).toISOString().substring(0, 7);
      monthlySpending[month] = (monthlySpending[month] || 0) + parseFloat(e.amount);
    });

    // Calculate user's specific share from splits
    const userSplits = splits.filter(s => s.user_id === userId);
    userSplits.forEach(s => {
      userShare += parseFloat(s.amount);
    });

    // Format monthly spending for Recharts
    const monthlyTrend = Object.keys(monthlySpending).map(month => ({
      month,
      amount: Math.round(monthlySpending[month] * 100) / 100
    })).sort((a, b) => a.month.localeCompare(b.month));

    // Format category distribution
    const categoryDist = Object.keys(categoryBreakdown).map(cat => ({
      category: cat,
      amount: Math.round(categoryBreakdown[cat] * 100) / 100
    }));

    return res.status(200).json({
      totalExpenses: Math.round(totalSpend * 100) / 100,
      userShare: Math.round(userShare * 100) / 100,
      monthlyTrend,
      categoryDistribution: categoryDist,
      expenseCount: expenses.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Export Reports
export const exportReport = async (req, res) => {
  const userId = req.user.id;
  const { format } = req.params; // 'csv' | 'excel' | 'pdf'
  const { group_id, start_date, end_date } = req.query;

  try {
    const { expenses, splits, groupName } = await fetchReportData(userId, group_id, start_date, end_date);

    // Map profiles for payer names
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name');
    const getPayerName = (id) => {
      const p = profiles?.find(p => p.id === id);
      return p ? p.full_name : 'Unknown';
    };

    // Format data rows
    const reportRows = expenses.map(e => {
      const userSplit = splits.find(s => s.expense_id === e.id && s.user_id === userId);
      return {
        Date: new Date(e.expense_date).toLocaleDateString(),
        Title: e.title,
        Category: e.category,
        'Paid By': getPayerName(e.paid_by),
        'Total Amount': parseFloat(e.amount),
        'Your Share': userSplit ? parseFloat(userSplit.amount) : 0
      };
    });

    if (format === 'csv') {
      let csvContent = 'Date,Title,Category,Paid By,Total Amount,Your Share\n';
      reportRows.forEach(row => {
        csvContent += `"${row.Date}","${row.Title.replace(/"/g, '""')}","${row.Category}","${row['Paid By']}",${row['Total Amount']},${row['Your Share']}\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=Expense_Report_${Date.now()}.csv`);
      return res.status(200).send(csvContent);

    } else if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(reportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Expense_Report_${Date.now()}.xlsx`);
      return res.status(200).send(buffer);

    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      let buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Expense_Report_${Date.now()}.pdf`);
        res.status(200).send(pdfData);
      });

      // PDF Content Design
      doc.fillColor('#4F46E5').fontSize(24).text('EXPENSE SUMMARY REPORT', { align: 'center' });
      doc.moveDown(0.2);
      doc.fillColor('#4B5563').fontSize(10).text(`Generated for: ${groupName}`, { align: 'center' });
      if (start_date || end_date) {
        doc.text(`Timeline: ${start_date || 'Inception'} to ${end_date || 'Today'}`, { align: 'center' });
      }
      doc.moveDown(1.5);

      // Calculations for summary card
      let totalAmount = 0;
      let totalShare = 0;
      reportRows.forEach(r => {
        totalAmount += r['Total Amount'];
        totalShare += r['Your Share'];
      });

      // Draw Summary Cards
      const cardY = doc.y;
      doc.rect(50, cardY, 240, 60).fill('#F3F4F6').stroke('#E5E7EB');
      doc.fillColor('#1F2937').fontSize(10).text('TOTAL GROUP SPEND', 60, cardY + 12);
      doc.fontSize(16).fillColor('#4F46E5').text(`$${totalAmount.toFixed(2)}`, 60, cardY + 28);

      doc.rect(310, cardY, 240, 60).fill('#F3F4F6').stroke('#E5E7EB');
      doc.fillColor('#1F2937').fontSize(10).text('YOUR TOTAL SHARE', 320, cardY + 12);
      doc.fontSize(16).fillColor('#10B981').text(`$${totalShare.toFixed(2)}`, 320, cardY + 28);

      doc.moveDown(4);

      // Draw Table Header
      doc.fontSize(12).fillColor('#1F2937').text('Expense Logs', 50, doc.y);
      doc.moveDown(0.5);
      const tableTop = doc.y;
      
      doc.fillColor('#4F46E5').fontSize(9);
      doc.text('Date', 50, tableTop);
      doc.text('Title', 120, tableTop);
      doc.text('Category', 240, tableTop);
      doc.text('Paid By', 330, tableTop);
      doc.text('Total', 430, tableTop, { width: 50, align: 'right' });
      doc.text('Your Share', 490, tableTop, { width: 60, align: 'right' });

      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#E5E7EB').stroke();
      doc.moveDown(1);

      // Draw Rows
      let rowY = tableTop + 22;
      doc.fillColor('#374151');
      reportRows.forEach(row => {
        // Page break check
        if (rowY > 700) {
          doc.addPage();
          rowY = 50;
        }

        doc.text(row.Date, 50, rowY);
        doc.text(row.Title.substring(0, 20), 120, rowY);
        doc.text(row.Category, 240, rowY);
        doc.text(row['Paid By'].substring(0, 15), 330, rowY);
        doc.text(`$${row['Total Amount'].toFixed(2)}`, 430, rowY, { width: 50, align: 'right' });
        doc.text(`$${row['Your Share'].toFixed(2)}`, 490, rowY, { width: 60, align: 'right' });

        doc.moveTo(50, rowY + 12).lineTo(550, rowY + 12).strokeColor('#F3F4F6').stroke();
        rowY += 18;
      });

      doc.end();
    } else {
      return res.status(400).json({ error: 'Unsupported format. Choose csv, excel, or pdf.' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
