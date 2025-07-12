# 🔐 Node.js Authentication API

A robust and secure authentication system built with Node.js, Express.js, and MongoDB. This API provides comprehensive user authentication features including JWT token management, Google OAuth integration, role-based access control, and automated token cleanup.

## ✨ Features

- **User Authentication**: Register, login, logout with email/password
- **JWT Token Management**: Access tokens (15min) and refresh tokens (7 days)
- **Google OAuth 2.0**: Social login integration
- **Role-Based Access Control**: User and admin roles
- **Security**: Password hashing with bcrypt, CORS protection, rate limiting
- **Activity Logging**: Comprehensive audit trail for all user activities
- **Automated Token Cleanup**: Scheduled cleanup of expired tokens
- **Input Validation**: Robust validation and sanitization
- **Error Handling**: Comprehensive error handling with consistent responses

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js 4.18.2
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT, Passport.js (Google OAuth)
- **Security**: bcrypt, CORS, express-rate-limit
- **Environment**: dotenv for configuration management

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- Node.js (version 16 or higher)
- MongoDB (local installation or MongoDB Atlas)
- Google OAuth credentials (for social login)

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/uehdud/nodejs-auth-api.git
cd nodejs-auth-api
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/auth_service

# JWT Secrets (Generate strong secrets for production)
JWT_ACCESS_SECRET=your-super-secret-access-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Google OAuth (Get from Google Developer Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 4. Start MongoDB
Make sure MongoDB is running on your system:
```bash
# For Windows (if installed as service)
net start MongoDB

# For macOS/Linux
mongod
```

### 5. Run the application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | ❌ |
| POST | `/auth/login` | User login | ❌ |
| POST | `/auth/logout` | User logout | ✅ |
| POST | `/auth/refresh` | Refresh access token | ❌ |
| GET | `/auth/me` | Get current user profile | ✅ |

### Google OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/google/callback` | Google OAuth callback |
| GET | `/auth/google/success` | OAuth success page |
| GET | `/auth/google/result` | Get OAuth tokens |

### User Management (Admin Only)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users` | Get all users | ✅ Admin |
| GET | `/users/:id` | Get user by ID | ✅ Admin |
| PUT | `/users/:id/role` | Update user role | ✅ Admin |
| DELETE | `/users/:id` | Delete user | ✅ Admin |

### Activity Logs (Admin Only)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/logs` | Get activity logs | ✅ Admin |
| GET | `/logs/stats` | Get activity statistics | ✅ Admin |

### Token Management (Admin Only)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/auth/tokens` | Debug user tokens | ✅ Admin |
| POST | `/auth/cleanup-tokens` | Manual token cleanup | ✅ Admin |
| GET | `/auth/token-stats` | Token statistics | ✅ Admin |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health status |

## 🔑 Authentication

### Bearer Token Authentication
Include the JWT access token in the Authorization header:
```
Authorization: Bearer <your-access-token>
```

### Token Refresh
When access token expires, use the refresh token to get a new access token:
```bash
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

## 📝 Request/Response Examples

### Register User
```bash
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

### Login
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

### Response Format
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token"
    }
  }
}
```

## 🔒 Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Security**: Separate secrets for access and refresh tokens
- **CORS Protection**: Configurable allowed origins
- **Rate Limiting**: Request rate limiting per IP
- **Input Validation**: Comprehensive input validation and sanitization
- **Activity Logging**: All authentication activities are logged
- **Token Cleanup**: Automatic cleanup of expired tokens
- **Role-Based Access**: Admin and user role separation

## 🏗️ Project Structure

```
├── app.js                 # Application entry point
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── config/
│   ├── database.js        # MongoDB connection
│   └── passport.js        # Passport.js configuration
├── models/
│   ├── User.js           # User model with token management
│   └── ActivityLog.js    # Activity logging model
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── google.js         # Google OAuth routes
│   ├── users.js          # User management routes
│   └── logs.js           # Activity log routes
├── middleware/
│   └── auth.js           # JWT authentication middleware
├── utils/
│   ├── jwt.js            # JWT utilities
│   ├── activityLogger.js # Activity logging utilities
│   └── tokenCleanup.js   # Token cleanup system
└── postman_collection.json # Postman API collection
```

## 🧪 Testing

Import the included Postman collection (`postman_collection.json`) to test all API endpoints with pre-configured requests.

### Test Flow:
1. Register a new user
2. Login to get tokens
3. Access protected endpoints with Bearer token
4. Test Google OAuth flow
5. Test admin endpoints (after promoting user to admin)

## 🚀 Deployment

### Environment Variables for Production:
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_ACCESS_SECRET=strong-production-secret
JWT_REFRESH_SECRET=another-strong-production-secret
FRONTEND_URL=https://yourdomain.com
GOOGLE_CLIENT_ID=production-google-client-id
GOOGLE_CLIENT_SECRET=production-google-client-secret
```

### Production Considerations:
- Use strong, unique JWT secrets
- Enable HTTPS
- Set secure cookie flags
- Configure proper CORS origins
- Set up MongoDB Atlas or secure MongoDB instance
- Configure proper logging and monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Your Name**
- GitHub: [@uehdud](https://github.com/uehdud)

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) for the web framework
- [MongoDB](https://www.mongodb.com/) for the database
- [Passport.js](http://www.passportjs.org/) for authentication strategies
- [JWT](https://jwt.io/) for token-based authentication
