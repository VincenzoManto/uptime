# Release Note v1.1.0 - June 13, 2025


### feat: Implement error tracking and uptime monitoring with SQLite database- Added SQLite database integration for error tracking and uptime monitoring. - Created `initDb` function to initialize the database and create necessary tables. - Developed `renderDashboard` function to generate HTML dashboard for displaying incidents and uptime. - Implemented Express middleware and Fastify plugin for error tracking and dashboard rendering. - Set up periodic pinging of routes to log uptime and latency. - Added tests for database operations and frontend rendering. - Configured TypeScript with strict settings and output directory. 

![impact](https://img.shields.io/badge/impact-high-red?style=flat-square)
- **Author:** [vincmanto](https://github.com/vincmanto) ![Author Image](https://avatars.githubusercontent.com/vincmanto?size=40)
- **Date:** Fri Jun 13 17:37:46 2025 +0200
- **Files Modified:** 26
    
