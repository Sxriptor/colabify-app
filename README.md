# DevPulse

DevPulse is a lightweight SaaS platform that helps development teams stay informed about GitHub repository activity across multiple projects. The platform provides clean, project-scoped notifications delivered via email, eliminating the noise of GitHub's default notification system.

## Features

- **Multi-project Management**: Organize repositories into projects with team-based access control
- **Smart Notifications**: Receive clean, formatted email notifications for GitHub activity
- **Flexible Delivery**: Choose between instant notifications or daily digest emails
- **Team Collaboration**: Invite team members and manage project access
- **GitHub Integration**: Seamless OAuth integration with automatic webhook setup

## Tech Stack

- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Supabase for database and authentication
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth with GitHub OAuth
- **Email**: Resend for transactional emails
- **Deployment**: Vercel (frontend), Supabase (backend)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- GitHub OAuth app (for authentication)
- Resend account (for email delivery)

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Copy the environment variables template:
```bash
cp .env.example .env.local
```

3. Configure your environment variables in `.env.local`:
   - Set up your Supabase project URL and keys
   - Configure GitHub OAuth credentials
   - Add your Resend API key
   - Set NextAuth configuration

### Database Setup

1. Run database migrations to create tables:
```bash
npm run db:migrate
```

2. (Optional) Seed the database with sample data for development:
```bash
npm run db:seed
```

3. (Optional) Reset the database if needed:
```bash
npm run db:reset
```

### Development

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
devpulse/
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   ├── lib/                 # Utility libraries and configurations
│   └── types/               # TypeScript type definitions
├── database/
│   ├── schema.sql           # Database schema
│   └── seed.sql             # Development seed data
├── scripts/                 # Database management scripts
└── public/                  # Static assets
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `RESEND_API_KEY` | Resend API key for email delivery |
| `NEXTAUTH_URL` | Application URL (http://localhost:3000 for dev) |
| `NEXTAUTH_SECRET` | NextAuth secret for JWT signing |

## Database Schema

The application uses PostgreSQL with the following main tables:

- **users**: User accounts and preferences
- **projects**: Project containers for repositories
- **project_members**: Team membership and invitations
- **repositories**: Connected GitHub repositories
- **notifications**: Activity events and messages
- **email_deliveries**: Email delivery tracking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.