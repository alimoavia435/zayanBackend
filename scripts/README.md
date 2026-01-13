# Admin Setup Scripts

## Creating Your First Admin User

This script helps you create your first admin user for the Zayan Admin Panel.

### Prerequisites

1. Make sure your MongoDB database is running and accessible
2. Ensure you have a `.env` file in the `zayan_backend` directory with `MONGO_URI` set
3. Install dependencies: `npm install`

### Usage

#### Option 1: Using npm script (Recommended)

**Default credentials:**
```bash
npm run create-admin
```
This will create an admin with:
- Email: `admin@zayan.com`
- Password: `admin123`
- Role: `superAdmin`

**Custom credentials:**
```bash
npm run create-admin <email> <password> <role>
```

Example:
```bash
npm run create-admin admin@example.com MySecurePassword123 superAdmin
```

#### Option 2: Direct node command

```bash
node scripts/createAdmin.js <email> <password> <role>
```

### Available Roles

- `superAdmin` - Has all permissions automatically
- `moderator` - Moderate content (products, properties, reviews)
- `support` - Support role with limited permissions

### Examples

```bash
# Create a superAdmin
npm run create-admin admin@zayan.com MyPassword123 superAdmin

# Create a moderator
npm run create-admin moderator@zayan.com ModPassword123 moderator

# Create a support admin
npm run create-admin support@zayan.com SupportPass123 support
```

### Security Notes

⚠️ **Important:**
1. The script will NOT overwrite existing admin accounts
2. Change the default password immediately after first login
3. Use strong passwords in production
4. Keep admin credentials secure and never commit them to version control

### After Creating Admin

1. Start your backend server: `npm run dev` or `npm start`
2. Start your admin panel frontend: `cd ../zayan_admin && npm run dev`
3. Navigate to `http://localhost:3000/login`
4. Login with the credentials you just created
5. **Change your password** after first login for security

### Troubleshooting

**Error: MONGO_URI is not defined**
- Make sure you have a `.env` file in `zayan_backend` directory
- Add `MONGO_URI=your_mongodb_connection_string` to the `.env` file

**Error: Email already exists**
- The admin with that email already exists in the database
- Use a different email or delete the existing admin first

**Error: Cannot connect to MongoDB**
- Check that MongoDB is running
- Verify your `MONGO_URI` is correct
- Check your network/firewall settings

