# Setup Guide for Signin Logic

## 1. Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Or copy the dependencies from `package-dependencies.json` to your `package.json`.

## 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXTAUTH_URL=http://localhost:3000
```

## 3. Database Setup

1. Create a new Supabase project
2. Run the SQL from `database-schema.sql` in your Supabase SQL editor
3. Configure GitHub OAuth in Supabase:
   - Go to Authentication > Providers
   - Enable GitHub provider
   - Add your GitHub OAuth app credentials

## 4. GitHub OAuth App Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App with:
   - Application name: Your app name
   - Homepage URL: `http://localhost:3000` (or your domain)
   - Authorization callback URL: `http://localhost:3000/auth/callback`
3. Copy the Client ID and Client Secret to Supabase

## 5. File Integration

### Copy Files to Your Project

1. Copy all files from this folder to your Next.js project
2. Update import paths if your project structure differs
3. Ensure you have the required CSS classes (Tailwind CSS recommended)

### Update Your Root Layout

Replace your `app/layout.tsx` with the provided one, or add the `AuthProvider`:

```tsx
import { AuthProvider } from "@/lib/auth/context";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Add Middleware

Copy `middleware.ts` to your project root (same level as `app/` folder).

## 6. Usage in Components

```tsx
import { useAuth } from '@/lib/auth/context'

function MyComponent() {
  const { user, customUser, loading, signOut } = useAuth()
  
  if (loading) return <div>Loading...</div>
  
  if (!user) return <div>Please sign in</div>
  
  return (
    <div>
      <p>Welcome, {customUser?.name || user.email}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

## 7. Protected Routes

Routes are automatically protected by the middleware. Users will be redirected to `/login` if not authenticated.

To exclude routes from protection, update the middleware matcher in `middleware.ts`.

## 8. Electron Support (Optional)

If you're building an Electron app, the authentication system includes:

- Electron-specific auth flows
- External browser OAuth handling
- Custom protocol handling (`colabify://auth/callback`)

Make sure your Electron main process handles the custom protocol and IPC events as shown in the components.

## 9. Customization

### Styling
- Update CSS classes in form components
- Modify the layout and design to match your app

### Branding
- Change app name in page titles and descriptions
- Update OAuth redirect URLs
- Modify success/error messages

### Additional User Fields
- Add more fields to the `users` table
- Update the `CustomUser` type in `context.tsx`
- Modify `user-management.ts` to handle new fields

## 10. Testing

1. Start your development server: `npm run dev`
2. Navigate to `/login` or `/signup`
3. Test the GitHub OAuth flow
4. Verify user creation in Supabase dashboard
5. Test sign out functionality

## Troubleshooting

### Common Issues

1. **OAuth redirect mismatch**: Ensure callback URLs match in GitHub and Supabase
2. **Environment variables**: Double-check all required env vars are set
3. **Database permissions**: Verify RLS policies are correctly configured
4. **Import errors**: Update import paths to match your project structure

### Debug Mode

Enable debug logging by adding to your environment:

```env
NEXT_PUBLIC_DEBUG=true
```

The authentication system includes extensive console logging for debugging.

## Security Notes

- Never expose service role keys in client-side code
- Use environment variables for all sensitive data
- Regularly rotate OAuth secrets
- Monitor authentication logs in Supabase dashboard
- Implement proper error handling for production