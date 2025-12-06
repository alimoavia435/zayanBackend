import User from "../model/User.js";
import Property from "../model/Property.js";
import Store from "../model/Store.js";
import Product from "../model/Product.js";

export const buildProfileResponse = async (userId, role = "realestate_seller") => {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    return null;
  }

  // Calculate stats based on role
  let totalProperties = 0;
  let totalViews = 0;
  let totalStores = 0;
  let totalProducts = 0;
  let totalFollowers = 0;

  if (role === "ecommerce_seller") {
    // For ecommerce seller, calculate stores and products
    const stores = await Store.find({ owner: userId }).select("followers views");
    totalStores = stores?.length || 0;
    totalFollowers = stores?.reduce((sum, store) => sum + (store.followers || 0), 0) || 0;
    totalViews = stores?.reduce((sum, store) => sum + (store.views || 0), 0) || 0;
    
    const products = await Product.find({ owner: userId });
    totalProducts = products?.length || 0;
  } else {
    // For real estate seller, calculate properties
    const properties = await Property.find({ owner: userId }).select("views");
    totalProperties = properties?.length || 0;
    totalViews = properties?.reduce(
      (sum, property) => sum + (property.views || 0),
      0
    ) || 0;
  }

  // Get role-specific profile or fallback to legacy fields
  let profileData = {}
  if (role && user.profiles && user.profiles.get(role)) {
    const roleProfile = user.profiles.get(role);
    // Convert Mongoose subdocument to plain object if needed
    if (roleProfile && typeof roleProfile === 'object') {
      if (roleProfile._doc) {
        // It's a Mongoose subdocument - extract the actual data
        profileData = { ...roleProfile._doc };
      } else if (roleProfile.toObject && typeof roleProfile.toObject === 'function') {
        profileData = roleProfile.toObject();
      } else {
        // It's already a plain object
        profileData = { ...roleProfile };
      }
    }
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

  // Use profile data or fallback to user name parsing
  const firstName = profileData.firstName || (user.name ? user.name.split(" ")[0] : "") || "";
  const lastName = profileData.lastName ||
    (user.name ? user.name.split(" ").slice(1).join(" ") : "") ||
    "";

  // Get rating from profile data, with fallback to root level rating
  const rating = profileData.rating !== undefined && profileData.rating !== null 
    ? profileData.rating 
    : (user.rating !== undefined && user.rating !== null ? user.rating : 0);

  const response = {
    id: user._id,
    firstName,
    lastName,
    email: user.email,
    phone: profileData.phone || "",
    bio: profileData.bio || "",
    specialization: profileData.specialization || "",
    agency: profileData.agency || "",
    city: profileData.city || "",
    state: profileData.state || "",
    certifications: profileData.certifications || "",
    languages: profileData.languages || [],
    avatar: profileData.avatar || "",
    rating: rating,
  };

  // Add role-specific stats
  if (role === "ecommerce_seller") {
    response.totalStores = totalStores;
    response.totalProducts = totalProducts;
    response.totalFollowers = totalFollowers;
    response.totalViews = totalViews;
  } else {
    response.totalProperties = totalProperties;
    response.totalViews = totalViews;
  }

  return response;
};

export const getSellerProfile = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get role from query parameter, default to realestate_seller
    const role = req.query.role || "realestate_seller";
    
    const profile = await buildProfileResponse(req.user._id, role);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.json({ profile });
  } catch (error) {
    console.error("getSellerProfile error", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getSellerProfileById = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    // Get role from query parameter, default to realestate_seller
    const role = req.query.role || "realestate_seller";

    const profile = await buildProfileResponse(id, role);

    if (!profile) {
      return res.status(404).json({ message: "Seller profile not found" });
    }

    return res.json({ profile });
  } catch (error) {
    console.error("getSellerProfileById error", error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateSellerProfile = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get role from query parameter or body, default to realestate_seller
    const role = req.query.role || req.body.role || "realestate_seller";

    const {
      firstName,
      lastName,
      phone,
      bio,
      specialization,
      agency,
      city,
      state,
      country,
      certifications,
      languages,
      avatar,
    } = req.body;

    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Initialize profiles map if it doesn't exist
    if (!user.profiles) {
      user.profiles = new Map();
    }

    // Get existing profile for this role or create new one
    const existingProfile = user.profiles.get(role);
    
    // Convert Mongoose subdocument to plain object to avoid modification issues
    // Mongoose subdocuments have _doc property with actual values, we need plain object
    let existingProfilePlain = {};
    if (existingProfile) {
      // Check if it's a Mongoose subdocument by looking for _doc
      if (existingProfile._doc) {
        // It's a Mongoose subdocument - extract the actual data from _doc
        existingProfilePlain = JSON.parse(JSON.stringify(existingProfile._doc));
      } else if (existingProfile.toObject && typeof existingProfile.toObject === 'function') {
        existingProfilePlain = existingProfile.toObject();
      } else {
        // It's already a plain object
        existingProfilePlain = JSON.parse(JSON.stringify(existingProfile));
      }
    }
    
    // Build updated profile object as a plain object (not Mongoose subdocument)
    const updatedProfile = {
      ...existingProfilePlain,
    };
    
    // Update fields if they are provided in the request (including empty strings)
    if (firstName !== undefined) updatedProfile.firstName = firstName;
    if (lastName !== undefined) updatedProfile.lastName = lastName;
    if (phone !== undefined) updatedProfile.phone = phone;
    if (bio !== undefined) updatedProfile.bio = bio;
    if (specialization !== undefined) updatedProfile.specialization = specialization;
    if (agency !== undefined) updatedProfile.agency = agency;
    if (city !== undefined) updatedProfile.city = city;
    if (state !== undefined) updatedProfile.state = state;
    if (country !== undefined) updatedProfile.country = country;
    if (certifications !== undefined) updatedProfile.certifications = certifications;
    if (avatar !== undefined) updatedProfile.avatar = avatar || '';
    


    // Handle languages
    if (languages !== undefined) {
      if (Array.isArray(languages)) {
        updatedProfile.languages = languages;
      } else if (typeof languages === "string") {
        updatedProfile.languages = languages
          .split(",")
          .map((lang) => lang.trim())
          .filter(Boolean);
      }
    } else if (existingProfilePlain.languages) {
      updatedProfile.languages = existingProfilePlain.languages;
    } else {
      updatedProfile.languages = [];
    }

    // Update the profile in the profiles map
    user.profiles.set(role, updatedProfile);
    
    // Mark the profiles map as modified so Mongoose saves it
    user.markModified('profiles');

    // Update user name if firstName or lastName changed
    if (firstName !== undefined || lastName !== undefined) {
      const newFirstName = firstName !== undefined ? firstName : existingProfilePlain.firstName;
      const newLastName = lastName !== undefined ? lastName : existingProfilePlain.lastName;
      const combinedName = `${newFirstName ?? ""} ${newLastName ?? ""}`
        .trim()
        .replace(/\s+/g, " ");
      if (combinedName) {
        user.name = combinedName;
      }
    }

    // Save the user
    await user.save();
    
    // Refresh user from database to ensure we have the latest data
    const updatedUser = await User.findById(req.user._id).select("-password");
    
    // Verify the save worked
    const savedProfile = updatedUser.profiles?.get(role);
    console.log('After save - Role:', role);
    console.log('After save - Profile data:', savedProfile);
    
    const profile = await buildProfileResponse(updatedUser._id, role);
    
    // Log the returned profile to verify it has the updated data
    console.log('Returned profile:', JSON.stringify(profile, null, 2));

    return res.json({
      message: "Profile updated successfully",
      profile,
    });
  } catch (error) {
    console.error("updateSellerProfile error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get top sellers (first 3 high rating)
// export const getTopSellers = async (req, res) => {
//   try {
//     console.log("getTopSellers",req?.query);
//     if (!req.user?._id) {
//       return res.status(401).json({ message: "Unauthorized" });
//     }

//     const role = req.query.role || "realEstateSeller";
//     console.log(role,"role");
//     const limit = parseInt(req.query.limit) || 3;
//     console.log(limit,"limit");
//     // Find all users with realestate_seller role
//     // roles is an array, so we check if the role exists in the array
//     const sellers = await User.find({
//       roles: role  // This will match if role exists in the roles array
//     }).select("-password");

//     console.log(sellers.length, "sellers found");
//     console.log(sellers.map(s => ({ id: s._id, name: s.name, roles: s.roles })), "sellers details");
    
//     // Build profiles for all sellers and calculate their ratings
//     const sellerProfiles = await Promise.all(
//       sellers?.map(async (seller) => {
//         const profile = await buildProfileResponse(seller._id, "realestate_seller");
//         console.log(`Seller ${seller._id}: profile =`, profile ? { rating: profile.rating, firstName: profile.firstName, lastName: profile.lastName } : 'null');
//         if (profile) {
//           // Include all sellers, even with rating 0, but we'll filter later
//           return {
//             ...profile,
//             name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || seller.name || seller.email,
//             reviews: 0, // Estimate reviews based on properties
//           };
//         }
//         return null;
//       })
//     );
    
//     console.log("sellerProfiles before filter:", sellerProfiles.map(p => p ? { name: p.name, rating: p.rating } : null));

//     // Filter out null profiles, sort by rating (descending), and take top N
//     // Changed: Include sellers even with rating 0, but prioritize those with higher ratings
//     const validProfiles = sellerProfiles.filter(profile => profile !== null);
//     console.log("validProfiles count:", validProfiles.length);
//     console.log("validProfiles ratings:", validProfiles.map(p => ({ name: p.name, rating: p.rating })));
    
//     const topSellers = validProfiles
//       .sort((a, b) => {
//         // Sort by rating (descending), but if ratings are equal, sort by totalProperties (descending)
//         if (b.rating !== a.rating) {
//           return b.rating - a.rating;
//         }
//         return (b.totalProperties || 0) - (a.totalProperties || 0);
//       })
//       .slice(0, limit);

//     console.log(topSellers,"topSellers at end");
//     return res.json({
//       message: "Top sellers fetched successfully",
//       sellers: topSellers,
//     });
//   } catch (error) {
//     console.error("getTopSellers error", error);
//     return res.status(500).json({ message: error.message });
//   }
// };

export const getTopSellers = async (req, res) => {
  try {
    const role = req.query.role || "realEstateSeller";
    const limit = parseInt(req.query.limit) || 3;

    const sellers = await User.aggregate([
      {
        $match: {
          roles: role,
          "profiles.realestate_seller": { $exists: true }
        }
      },

      // 1️⃣ JOIN properties collection where owner = user._id
      {
        $lookup: {
          from: "properties",
          localField: "_id",
          foreignField: "owner",
          as: "propertiesList"
        }
      },

      // 2️⃣ ADD propertiesCount field
      {
        $addFields: {
          propertiesCount: { $size: "$propertiesList" }
        }
      },

      // 3️⃣ REMOVE large property list (optional)
      {
        $project: {
          propertiesList: 0
        }
      },

      // 4️⃣ FLATTEN AND FORMAT OUTPUT
      {
        $project: {
          email: 1,

          name: {
            $concat: [
              { $ifNull: ["$profiles.realestate_seller.firstName", ""] },
              " ",
              { $ifNull: ["$profiles.realestate_seller.lastName", ""] }
            ]
          },

          rating: "$profiles.realestate_seller.rating",
          totalProperties: "$propertiesCount",

          phone: "$profiles.realestate_seller.phone",
          bio: "$profiles.realestate_seller.bio",
          specialization: "$profiles.realestate_seller.specialization",
          agency: "$profiles.realestate_seller.agency",
          certifications: "$profiles.realestate_seller.certifications",
          languages: "$profiles.realestate_seller.languages",
          avatar: "$profiles.realestate_seller.avatar",
          city: "$profiles.realestate_seller.city",
          state: "$profiles.realestate_seller.state",
        }
      },

      // 5️⃣ SORT by rating → totalProperties
      {
        $sort: {
          rating: -1,
          totalProperties: -1,
        }
      },

      // 6️⃣ LIMIT
      { $limit: limit }
    ]);

    return res.json({
      message: "Top sellers fetched successfully",
      sellers,
    });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};




