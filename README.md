# NCKU Campus Safety Reporting Platform

A web application for reporting safety concerns on the NCKU campus.

## Features

- Interactive map for reporting and viewing safety concerns
- Support for different types of reports: roads, accessible ramps, street lights, etc.
- Photo upload capability
- Real-time updates

## Tech Stack

- Frontend: HTML/CSS/JavaScript with Leaflet.js for maps
- Backend: Node.js with Express
- Database: MongoDB
- File Storage: Local file system (for development)

## Deployment Instructions

### Prerequisites

- Node.js (v18.x recommended)
- MongoDB account (for MongoDB Atlas)
- Render.com, Heroku, or similar platform account

### Local Development

1. Clone the repository
2. Install dependencies:
   ```
   cd ncku_campus_backend
   npm install
   ```
3. Start MongoDB locally or set up MongoDB Atlas
4. Start the development server:
   ```
   npm run dev
   ```

### Deployment to Render.com

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure settings:
   - Environment: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `node server.js`
4. Add environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `PORT`: 3000 (or leave as 3002)

### Deployment to Heroku

1. Install Heroku CLI
2. Login to Heroku:
   ```
   heroku login
   ```
3. Create a new Heroku app:
   ```
   heroku create ncku-campus-safety
   ```
4. Set up MongoDB Atlas and add the connection string:
   ```
   heroku config:set MONGODB_URI=your_mongodb_connection_string
   ```
5. Deploy the app:
   ```
   git push heroku main
   ```

## Updating the Frontend API URL

Before deployment, make sure to update the API_URL in script.js to point to your deployed backend URL.

## License

ISC 