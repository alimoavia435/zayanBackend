import User from '../model/User.js'
import bcrypt from 'bcryptjs'
import generateToken from '../utils/generateToken.js'
import { sendOtpEmail } from '../utils/sendEmail.js'

const OTP_EXPIRATION_MINUTES = 10

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString()
const normalizeEmail = (value = "") => value.trim().toLowerCase()

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, country, state, city } = req.body
    const normalizedEmail = normalizeEmail(email)

    const userExists = await User.findOne({ email: normalizedEmail })
    if (userExists)
      return res.status(400).json({ message: 'User already exists' })

    const hashedPassword = await bcrypt.hash(password, 10)
    const plainOtp = generateOtp()
    const hashedOtp = await bcrypt.hash(plainOtp, 10)

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      country,
      state,
      city,
      otpCode: hashedOtp,
      otpExpiresAt: new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000)
    })

    try {
      await sendOtpEmail({ to: email, otp: plainOtp, name })
    } catch (mailError) {
      await User.findByIdAndDelete(user._id)
      throw mailError
    }

    res.status(201).json({
      message: 'OTP sent to your email address. Please verify to continue.',
      email
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' })
    }

    const user = await User.findOne({ email: normalizedEmail })
    if (!user) return res.status(400).json({ message: 'User does not exist' })

    if (user.isVerified) {
      const token = generateToken(user._id)
      return res.json({
        message: 'Email already verified',
        user,
        token
      })
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      return res.status(400).json({ message: 'No OTP found. Please register again.' })
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP expired. Please request a new code.' })
    }

    const isMatch = await bcrypt.compare(otp, user.otpCode)
    if (!isMatch) return res.status(400).json({ message: 'Invalid OTP' })

    user.isVerified = true
    user.otpCode = undefined
    user.otpExpiresAt = undefined
    await user.save()

    const token = generateToken(user._id)

    res.json({
      message: 'Email verified successfully',
      user,
      token
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail) return res.status(400).json({ message: 'Email is required' })

    const user = await User.findOne({ email: normalizedEmail })
    if (!user) return res.status(400).json({ message: 'User does not exist' })

    if (user.isVerified) {
      return res.status(400).json({ message: 'User already verified' })
    }

    const plainOtp = generateOtp()
    const hashedOtp = await bcrypt.hash(plainOtp, 10)

    user.otpCode = hashedOtp
    user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000)
    await user.save()

    await sendOtpEmail({ to: email, otp: plainOtp, name: user.name })

    res.json({ message: 'A new OTP has been sent to your email' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body
    const normalizedEmail = normalizeEmail(email)

    const user = await User.findOne({ email: normalizedEmail })
    if (!user) return res.status(400).json({ message: 'User does not exist' })

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch)
      return res.status(400).json({ message: 'Invalid credentials' })

    const token = generateToken(user._id)

    res.json({
      message: 'Login successful',
      user,
      token
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const assignRoles = async (req, res) => {
  try {
    const { ecommerceBuyer, ecommerceSeller, realEstateBuyer, realEstateSeller } = req.body
    const userId = req.user._id

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Build roles array based on boolean flags
    const roles = []
    if (ecommerceBuyer === true) roles.push('ecommerceBuyer')
    if (ecommerceSeller === true) roles.push('ecommerceSeller')
    if (realEstateBuyer === true) roles.push('realEstateBuyer')
    if (realEstateSeller === true) roles.push('realEstateSeller')

    // Update roles
    user.roles = roles

    await user.save()

    res.json({
      message: 'Roles assigned successfully',
      user
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getCurrentUser = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { role } = req.query // Get role from query parameter
    const user = await User.findById(req.user._id).select('-password -otpCode')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // If role is specified, get role-specific profile
    let profileData = {}
    if (role && user.profiles && user.profiles.get(role)) {
      profileData = user.profiles.get(role)
    } else {
      // Fallback to legacy fields for backward compatibility
      profileData = {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        bio: user.bio,
        specialization: user.specialization,
        agency: user.agency,
        certifications: user.certifications,
        languages: user.languages,
        avatar: user.avatar,
        rating: user.rating,
        country: user.country,
        state: user.state,
        city: user.city,
      }
    }

    // Format join date
    const joinDate = user.createdAt
      ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : 'Recently'

    // Format location from profile or legacy
    const locationParts = []
    if (profileData.city) locationParts.push(profileData.city)
    if (profileData.state) locationParts.push(profileData.state)
    if (profileData.country) locationParts.push(profileData.country)
    const location = locationParts.length > 0 ? locationParts.join(', ') : 'Not specified'

    // Get name from profile or user
    const firstName = profileData.firstName || user.firstName
    const lastName = profileData.lastName || user.lastName
    const displayName = firstName && lastName 
      ? `${firstName} ${lastName}`.trim()
      : user.name || user.email

    res.json({
      message: 'User profile fetched successfully',
      user: {
        _id: user._id,
        name: displayName,
        firstName: firstName,
        lastName: lastName,
        email: user.email,
        phone: profileData.phone || '',
        avatar: profileData.avatar || (user.avatar && user.avatar.startsWith('http') ? user.avatar : '') || '',
        roles: user.roles || [],
        bio: profileData.bio || '',
        specialization: profileData.specialization || '',
        agency: profileData.agency || '',
        certifications: profileData.certifications || '',
        languages: profileData.languages || [],
        rating: profileData.rating || 0,
        country: profileData.country || '',
        state: profileData.state || '',
        city: profileData.city || '',
        location,
        joinDate: `Joined in ${joinDate}`,
        isVerified: user.isVerified || false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const requestPasswordResetOtp = async (req, res) => {
  try {
    const { email } = req.body
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' })
    }

    const user = await User.findOne({ email: normalizedEmail })
    if (!user) {
      return res.status(404).json({ message: 'User does not exist' })
    }

    const plainOtp = generateOtp()
    const hashedOtp = await bcrypt.hash(plainOtp, 10)

    user.passwordResetOtp = hashedOtp
    user.passwordResetExpiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000)
    await user.save()

    await sendOtpEmail({
      to: normalizedEmail,
      otp: plainOtp,
      name: user.name ?? 'User',
      subject: 'Password Reset OTP',
      intro: 'Use the OTP below to reset your password. It expires in 10 minutes.',
    })

    res.json({ message: 'OTP sent to your email address.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const verifyPasswordResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' })
    }

    const user = await User.findOne({ email: normalizedEmail })
    if (!user) {
      return res.status(404).json({ message: 'User does not exist' })
    }

    if (
      !user.passwordResetOtp ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' })
    }

    const isMatch = await bcrypt.compare(otp, user.passwordResetOtp)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid OTP' })
    }

    user.passwordResetOtpVerifiedAt = new Date()
    await user.save()

    res.json({ message: 'OTP verified successfully.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, newPassword } = req.body
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required.' })
    }

    const user = await User.findOne({ email: normalizedEmail })
    if (!user) {
      return res.status(404).json({ message: 'User does not exist' })
    }

    if (!user.passwordResetOtpVerifiedAt || !user.passwordResetOtp) {
      return res.status(400).json({ message: 'OTP verification required before resetting password.' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    user.password = hashedPassword
    user.passwordResetOtp = undefined
    user.passwordResetExpiresAt = undefined
    user.passwordResetOtpVerifiedAt = undefined
    await user.save()

    res.json({ message: 'Password reset successfully.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
