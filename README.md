# SplitMate - React Expense Sharing App

A beginner-friendly expense sharing demo built with React, CSS and browser Local Storage.

## Features
- Email signup and login
- Create groups and generate group codes
- Join groups using a code
- Add group expenses and split equally between current members
- View group members and expense history
- Admin dashboard to view users, groups and expenses, and delete expenses

## Run locally
1. Install Node.js.
2. Open this folder in VS Code.
3. Open the terminal in this folder.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open the local URL shown by Vite (usually http://localhost:5173).

## Demo admin
- Email: `admin@splitmate.com`
- Password: `admin123`

## Important limitations
This project stores data in the current browser's Local Storage. Group codes do not synchronize data across different devices or browsers. Email login is a local demo only; it does not send verification emails. Passwords are not securely protected. A shared backend and secure authentication are required for a real multi-device app.
