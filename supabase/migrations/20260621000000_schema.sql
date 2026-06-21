-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    mobile TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    paid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    category TEXT NOT NULL CHECK (category IN ('Food', 'Travel', 'Shopping', 'Rent', 'Utilities', 'Healthcare', 'Education', 'Entertainment', 'Other')),
    receipt_url TEXT,
    expense_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expense_splits table
CREATE TABLE IF NOT EXISTS public.expense_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    percentage NUMERIC(5, 2),
    shares INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create settlements table
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    from_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    to_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense_added', 'expense_updated', 'settlement_received', 'group_invite')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON public.expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON public.expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user ON public.expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON public.settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from ON public.settlements(from_user);
CREATE INDEX IF NOT EXISTS idx_settlements_to ON public.settlements(to_user);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Allow public read access to profiles" 
    ON public.profiles FOR SELECT 
    USING (true);

CREATE POLICY "Allow users to update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- 2. Groups Policies
CREATE POLICY "Allow members to view their groups" 
    ON public.groups FOR SELECT 
    USING (id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Allow authenticated users to create groups" 
    ON public.groups FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow group admins to update groups" 
    ON public.groups FOR UPDATE 
    USING (id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Allow group admins to delete groups" 
    ON public.groups FOR DELETE 
    USING (id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- 3. Group Members Policies
CREATE POLICY "Allow group members to view membership details" 
    ON public.group_members FOR SELECT 
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.groups g WHERE g.id = public.group_members.group_id AND g.created_by = auth.uid()
        )
    );

CREATE POLICY "Allow members to add themselves or admins to manage memberships" 
    ON public.group_members FOR INSERT 
    WITH CHECK (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid()
        )
    );

CREATE POLICY "Allow group admins to update membership roles" 
    ON public.group_members FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.groups g WHERE g.id = public.group_members.group_id AND g.created_by = auth.uid()
        )
    );

CREATE POLICY "Allow users to leave or group admins to remove members" 
    ON public.group_members FOR DELETE 
    USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.groups g WHERE g.id = public.group_members.group_id AND g.created_by = auth.uid()
        )
    );

-- 4. Expenses Policies
CREATE POLICY "Allow group members to view expenses" 
    ON public.expenses FOR SELECT 
    USING (group_id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Allow group members to create expenses" 
    ON public.expenses FOR INSERT 
    WITH CHECK (group_id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Allow group members to update expenses" 
    ON public.expenses FOR UPDATE 
    USING (group_id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Allow group members to delete expenses" 
    ON public.expenses FOR DELETE 
    USING (group_id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    ));

-- 5. Expense Splits Policies
CREATE POLICY "Allow group members to view splits" 
    ON public.expense_splits FOR SELECT 
    USING (expense_id IN (
        SELECT id FROM public.expenses WHERE group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Allow group members to create splits" 
    ON public.expense_splits FOR INSERT 
    WITH CHECK (expense_id IN (
        SELECT id FROM public.expenses WHERE group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Allow group members to update splits" 
    ON public.expense_splits FOR UPDATE 
    USING (expense_id IN (
        SELECT id FROM public.expenses WHERE group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Allow group members to delete splits" 
    ON public.expense_splits FOR DELETE 
    USING (expense_id IN (
        SELECT id FROM public.expenses WHERE group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    ));

-- 6. Settlements Policies
CREATE POLICY "Allow group members to view settlements" 
    ON public.settlements FOR SELECT 
    USING (group_id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Allow group members to create settlements" 
    ON public.settlements FOR INSERT 
    WITH CHECK (group_id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Allow group members to update settlements" 
    ON public.settlements FOR UPDATE 
    USING (group_id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    ));

-- 7. Notifications Policies
CREATE POLICY "Allow users to view their own notifications" 
    ON public.notifications FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Allow users to update their own notifications" 
    ON public.notifications FOR UPDATE 
    USING (user_id = auth.uid());

-- Trigger to create a profile automatically when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, mobile, avatar_url)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
        new.email,
        new.raw_user_meta_data->>'mobile',
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
