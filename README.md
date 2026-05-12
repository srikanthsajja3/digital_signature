# Digital Signature App - Setup Instructions

## 1. Supabase Setup

### Database Table
Go to your Supabase SQL Editor and run the following to create the `documents` table:

```sql
create table documents (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  details jsonb,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Enable Realtime (optional)
alter publication supabase_realtime add table documents;
```

### Storage Bucket
1. Go to **Storage** in your Supabase dashboard.
2. Create a new bucket named `pdfs`.
3. Set the bucket to **Public** (for easier prototype access).
4. Add a policy to allow public access for all operations (Select, Insert, Update, Delete) for the `pdfs` bucket if you want to test quickly.

## 2. Application Configuration
1. Open `utils/supabase.ts`.
2. Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your actual project credentials found in **Settings > API**.

## 3. Running the App
1. Navigate to the project directory: `cd development/digital-sign-app`.
2. Start the project: `npx expo start`.
3. Press `w` to open in your web browser.

## 4. Usage Flow
1. **Admin:** Go to the home page, enter customer details, and click "Generate Signing Link".
2. **Link:** Copy the generated link and open it in a new tab (simulating the customer).
3. **Customer:** Review the details, sign in the box, and click "Confirm Signature".
4. **Final:** Once signed, the "Download Signed PDF" button will appear.
