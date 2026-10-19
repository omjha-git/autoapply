# AutoApply — AI Job Application Copilot

Find opportunities, keep your job search organized, and manage applications from one place.

<p align="center">
  <a href="https://autoapply-navy.vercel.app"><strong>🚀 Live Demo</strong></a>
  &nbsp; · &nbsp;
  <a href="https://github.com/omjha-git/autoapply"><strong>📦 GitHub Repository</strong></a>
  &nbsp; · &nbsp;
  <a href="https://autoapply-1-m262.onrender.com/api/health"><strong>💚 API Health</strong></a>
</p>

## Overview

**AutoApply** is a full-stack job-search and application-management web app. It brings job discovery, profile and resume management, and application tracking into one interface, with AI-assisted functionality for the application workflow.

- **Live frontend:** https://autoapply-navy.vercel.app
- **Backend API:** https://autoapply-1-m262.onrender.com
- **Health endpoint:** https://autoapply-1-m262.onrender.com/api/health
- **Repository:** https://github.com/omjha-git/autoapply

> The frontend is hosted on Vercel and the Express API is hosted on Render. The first API request after an idle period may take longer while the backend wakes up.

## Features

- **Job discovery and search** — search opportunities by job title or skill and preferred location.
- **Dashboard** — view job-search and application statistics.
- **Profile management** — maintain your profile information.
- **Resume upload** — upload PDF, DOCX, or TXT resumes (maximum 10 MB per file).
- **Application tracking** — save jobs and manage application statuses.
- **AI-assisted cover letters** — generate or regenerate a cover letter for a saved application.
- **Authentication** — sign-in, sign-up, and protected application pages using Clerk.
- **Job-source configuration** — configure supported Greenhouse boards and Lever sites through environment variables.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite, React Router |
| UI / icons | CSS, Lucide React |
| API client | Axios |
| Backend | Node.js, Express 5 |
| Database | MongoDB, Mongoose |
| Authentication | Clerk React SDK and Clerk Express middleware |
| AI integration | Google GenAI SDK |
| Resume processing | PDF parsing, Mammoth for DOCX |
| Upload handling | Multer |
| Deployment | Vercel (frontend), Render (backend) |

## Application Pages

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/sign-in` | Sign in |
| `/sign-up` | Create an account |
| `/dashboard` | Dashboard and statistics (authenticated) |
| `/jobs` | Find and search jobs (authenticated) |
| `/applications` | Manage saved applications (authenticated) |
| `/profile` | Manage profile and resume (authenticated) |

## Architecture

```text
Browser
  |
  v
React + Vite frontend (Vercel)
  |
  | HTTPS /api requests + Clerk authentication
  v
Express REST API (Render)
  |                |
  v                v
MongoDB          AI / job-source integrations
```

The frontend uses `VITE_API_URL` as the API base URL. The backend mounts API routes under `/api` and exposes a health check at `/api/health`.

## Run Locally

### Prerequisites

- Node.js (use a current LTS release)
- npm
- MongoDB connection string
- Clerk application keys
- Google GenAI API key for AI-powered functionality

### 1. Clone the repository

```bash
git clone https://github.com/omjha-git/autoapply.git
cd autoapply
```

The project has separate `client` and `server` folders, so install dependencies in each.

### 2. Configure the backend

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory:

```dotenv
PORT=5000
MONGO_URI=your_mongodb_connection_string
CLERK_SECRET_KEY=your_clerk_secret_key
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=your_google_genai_api_key
GEMINI_MODEL=your_supported_gemini_model
GREENHOUSE_BOARD_TOKENS=
LEVER_SITES=
```

Fill in the values in your local environment. The Greenhouse and Lever variables are optional and depend on the job sources you want to configure. Never commit real secrets or paste them into issues.

Start the backend:

```bash
npm run dev
```

The API should be available at `http://localhost:5000`. Check the health endpoint at [http://localhost:5000/api/health](http://localhost:5000/api/health).

### 3. Configure the frontend

Open a second terminal:

```bash
cd client
npm install
```

Create a `.env` file in the `client` directory:

```dotenv
VITE_API_URL=http://localhost:5000/api
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

Use a Clerk publishable key belonging to the same Clerk instance as the backend secret key.

Start the frontend:

```bash
npm run dev
```

Vite will print the local URL, typically `http://localhost:5173`.

### 4. Build the frontend

From the `client` directory:

```bash
npm run build
npm run preview
```

### 5. Run backend tests

From the `server` directory:

```bash
npm test
```

## Environment Variables

| Variable | Where | Description |
| --- | --- | --- |
| `VITE_API_URL` | Frontend | Base URL for the backend API. Production: `https://autoapply-1-m262.onrender.com/api` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Clerk publishable key for the frontend's Clerk instance |
| `MONGO_URI` | Backend | MongoDB connection string |
| `CLERK_SECRET_KEY` | Backend | Clerk secret key for server-side authentication |
| `CLIENT_URL` | Backend | Exact frontend origin allowed by CORS. Production: `https://autoapply-navy.vercel.app` |
| `GEMINI_API_KEY` | Backend | API key for Google GenAI functionality |
| `GEMINI_MODEL` | Backend | Model identifier supported by your Google GenAI account and SDK |
| `GREENHOUSE_BOARD_TOKENS` | Backend | Optional configuration for Greenhouse job boards |
| `LEVER_SITES` | Backend | Optional configuration for Lever job sites |
| `PORT` | Backend | Port for the API server; hosting platforms usually supply this automatically |

**Important deployment notes**

- Set `VITE_API_URL` to the full API base URL, including `/api`.
- Set `CLIENT_URL` to the exact deployed frontend origin (no trailing slash), then redeploy the backend if required.
- Vite environment variables are embedded at build time. Redeploy the frontend after changing them.
- Never expose `CLERK_SECRET_KEY`, database credentials, or AI API keys in frontend variables, source control, screenshots, or public logs.
- Keep the Clerk frontend publishable key and backend secret key associated with the same Clerk instance/environment.

## API Overview

The API is mounted under `/api`. Protected routes require authentication.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API and database health |
| `GET` | `/api/jobs` | Retrieve jobs |
| `GET` | `/api/jobs/search` | Search jobs |
| `GET` | `/api/profile` | Retrieve profile |
| `PUT` | `/api/profile` | Update profile |
| `GET` | `/api/profile/dashboard-stats` | Dashboard statistics |
| `POST` | `/api/profile/resume` | Upload a resume using multipart field `resume` |
| `GET` | `/api/applications` | List applications |
| `POST` | `/api/applications` | Save/create an application |
| `PATCH` | `/api/applications/:id` | Update an application |
| `POST` | `/api/applications/:id/cover-letter` | Generate or regenerate a cover letter |

## Deployment

### Frontend — Vercel

- Deploy the `client` directory as the project root.
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_URL` and `VITE_CLERK_PUBLISHABLE_KEY` in the Vercel environment variables for the environments you deploy.

### Backend — Render

- Deploy the `server` directory as the service root.
- Build command: `npm install`
- Start command: `npm start`
- Configure `MONGO_URI`, `CLERK_SECRET_KEY`, `CLIENT_URL`, and the AI/job-source variables you use.
- Verify the deployment using the health endpoint linked above.

## Troubleshooting

**Job search reports a Network/CORS error**
1. Confirm `VITE_API_URL` is `https://autoapply-1-m262.onrender.com/api` in the Vercel project.
2. Confirm Render's `CLIENT_URL` exactly matches `https://autoapply-navy.vercel.app`.
3. Redeploy after changing environment variables.
4. In browser DevTools → Network, inspect the failed request and its response headers.

**Direct navigation to a route returns 404**
- Check the Vercel SPA rewrite configuration and ensure the deployment uses the `client` directory as its root.

**Authentication or OAuth fails**
- Confirm the Vercel publishable key and Render secret key belong to the same Clerk instance/environment.
- Verify the allowed origins and sign-in/sign-up settings in the Clerk dashboard.

**Health endpoint reports a database problem**
- Check the Render logs and confirm `MONGO_URI` is configured correctly. Do not share the connection string publicly.

## Security

- Keep secrets in local `.env` files or hosting-provider environment variables.
- Do not commit `.env` files, credentials, resume files, or private user data.
- Keep authenticated API routes protected and validate uploaded files and incoming data.
- Use HTTPS for deployed environments.

## Roadmap

Potential improvements for future iterations:

- [ ] Add more automated tests for job search, applications, and authentication.
- [ ] Improve job relevance ranking using resume skills and preferences.
- [ ] Add stronger deduplication and source-health monitoring for job listings.
- [ ] Improve deployment observability and user-facing error messages.
- [ ] Add screenshots or a short product demo to this README.

## Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes and run the relevant tests.
4. Open a pull request with a clear description of the change.

## License

No open-source license is currently specified in this repository. Until a license is added, do not assume that reuse, redistribution, or modification is permitted.
