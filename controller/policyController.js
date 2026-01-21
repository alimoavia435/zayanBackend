import Policy from "../model/Policy.js";

// Simple in-memory cache for public policies
const policyCache = {
  privacy: null,
  terms: null,
  cookies: null,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const isCacheValid = (entry) => {
  if (!entry) return false;
  return Date.now() - entry.cachedAt < CACHE_TTL_MS;
};

export const getPolicyByType = async (req, res) => {
  try {
    const { type } = req.params;

    if (!["privacy", "terms", "cookies"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid policy type",
      });
    }

    const cached = policyCache[type];
    if (isCacheValid(cached)) {
      return res.json({
        success: true,
        policy: cached.policy,
        fromCache: true,
      });
    }

    const policy = await Policy.findOne({ type }).lean();

    if (!policy) {
      // Return 200 with success: false for admin panel to handle gracefully
      // Admin panel can create new policies if they don't exist
      return res.status(200).json({
        success: false,
        message: "Policy not found",
      });
    }

    policyCache[type] = {
      policy,
      cachedAt: Date.now(),
    };

    return res.json({
      success: true,
      policy,
    });
  } catch (error) {
    console.error("getPolicyByType error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load policy",
    });
  }
};

export const upsertPolicy = async (req, res) => {
  try {
    const { type } = req.params;
    const { content, version, lastUpdated } = req.body;

    if (!["privacy", "terms", "cookies"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid policy type",
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Content is required",
      });
    }

    // Check if policy exists
    const existingPolicy = await Policy.findOne({ type }).lean();

    // Prepare update object
    const updateData = {
      content,
      lastUpdated: lastUpdated ? new Date(lastUpdated) : new Date(),
    };

    // Only set version if provided
    if (version) {
      updateData.version = version;
    } else if (!existingPolicy) {
      // Only set default version if creating new policy
      updateData.version = "1.0.0";
    }

    // Use different update strategies for existing vs new documents
    let policy;
    if (existingPolicy) {
      // Update existing policy
      policy = await Policy.findOneAndUpdate(
        { type },
        { $set: updateData },
        { new: true }
      ).lean();
    } else {
      // Create new policy
      policy = await Policy.create({
        type,
        ...updateData,
      });
      policy = policy.toObject();
    }

    // Invalidate cache
    policyCache[type] = {
      policy,
      cachedAt: Date.now(),
    };

    return res.json({
      success: true,
      message: "Policy saved successfully",
      policy,
    });
  } catch (error) {
    console.error("upsertPolicy error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save policy",
    });
  }
};


