import AnalyticsEvent from "../model/AnalyticsEvent.js";
import Product from "../model/Product.js";
import Property from "../model/Property.js";
import Conversation from "../model/Conversation.js";
import Message from "../model/Message.js";

// Track an event
export const trackEvent = async (req, res) => {
  try {
    const {
      eventType,
      itemType,
      itemId,
      sessionId,
      metadata = {},
      responseTime = null,
      conversationId = null,
    } = req.body;

    // Validate event type
    const validEventTypes = [
      "view",
      "click",
      "chat_started",
      "message_sent",
      "message_received",
    ];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({ message: "Invalid event type" });
    }

    // Validate item type
    if (!["product", "property"].includes(itemType)) {
      return res.status(400).json({ message: "Invalid item type" });
    }

    // Get the item to find owner
    let ownerId = null;
    if (itemType === "product") {
      const product = await Product.findById(itemId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      ownerId = product.owner;
    } else {
      const property = await Property.findById(itemId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      ownerId = property.owner;
    }

    if (!ownerId) {
      return res.status(400).json({ message: "Item owner not found" });
    }

    // Create event
    const event = await AnalyticsEvent.create({
      eventType,
      itemType,
      itemId,
      itemModel: itemType === "product" ? "Product" : "Property",
      ownerId,
      userId: req.user?._id || null,
      sessionId: sessionId || null,
      metadata,
      responseTime,
      conversationId,
    });

    // Increment counters on the item itself for quick access
    if (itemType === "product") {
      if (eventType === "view") {
        await Product.findByIdAndUpdate(itemId, { $inc: { views: 1 } });
      } else if (eventType === "chat_started") {
        // Assuming products don't have an "inquiries" field yet, but good to add if they do
        // await Product.findByIdAndUpdate(itemId, { $inc: { inquiries: 1 } });
      }
    } else if (itemType === "property") {
      if (eventType === "view") {
        await Property.findByIdAndUpdate(itemId, { $inc: { views: 1 } });
      } else if (eventType === "chat_started") {
        await Property.findByIdAndUpdate(itemId, { $inc: { inquiries: 1 } });
      }
    }

    return res.status(201).json({
      message: "Event tracked successfully",
      eventId: event._id,
    });
  } catch (error) {
    console.error("trackEvent error", error);
    return res.status(500).json({ message: "Failed to track event" });
  }
};

// Get analytics overview for a seller/agent
export const getAnalyticsOverview = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate, itemType, itemId } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // Build owner filter (user must own the items)
    const baseFilter = {
      ownerId: userId,
      ...dateFilter,
    };

    if (itemType) {
      baseFilter.itemType = itemType;
    }

    if (itemId) {
      baseFilter.itemId = itemId;
    }

    // Aggregate metrics using MongoDB aggregation pipeline
    const metrics = await AnalyticsEvent.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Format metrics
    const formattedMetrics = {
      views: 0,
      clicks: 0,
      chatsStarted: 0,
      messagesSent: 0,
      messagesReceived: 0,
    };

    metrics.forEach((metric) => {
      switch (metric._id) {
        case "view":
          formattedMetrics.views = metric.count;
          break;
        case "click":
          formattedMetrics.clicks = metric.count;
          break;
        case "chat_started":
          formattedMetrics.chatsStarted = metric.count;
          break;
        case "message_sent":
          formattedMetrics.messagesSent = metric.count;
          break;
        case "message_received":
          formattedMetrics.messagesReceived = metric.count;
          break;
      }
    });

    // Calculate conversion rate (chats started / views * 100)
    const conversionRate =
      formattedMetrics.views > 0
        ? (
            (formattedMetrics.chatsStarted / formattedMetrics.views) *
            100
          ).toFixed(2)
        : 0;

    // Calculate average response time (only for chats)
    const responseTimeData = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...baseFilter,
          eventType: "message_received",
          responseTime: { $ne: null, $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: "$responseTime" },
          count: { $sum: 1 },
        },
      },
    ]);

    const avgResponseTime =
      responseTimeData.length > 0 && responseTimeData[0].avgResponseTime
        ? Math.round(responseTimeData[0].avgResponseTime / 1000 / 60) // Convert to minutes
        : null;

    return res.status(200).json({
      message: "Analytics retrieved successfully",
      metrics: {
        ...formattedMetrics,
        conversionRate: parseFloat(conversionRate),
        avgResponseTimeMinutes: avgResponseTime,
      },
    });
  } catch (error) {
    console.error("getAnalyticsOverview error", error);
    return res.status(500).json({ message: "Failed to retrieve analytics" });
  }
};

// Get time series data for charts
export const getTimeSeriesData = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      startDate,
      endDate,
      itemType,
      itemId,
      eventType,
      groupBy = "day",
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    } else {
      // Default to last 30 days
      const defaultEndDate = new Date();
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 30);
      dateFilter.createdAt = {
        $gte: defaultStartDate,
        $lte: defaultEndDate,
      };
    }

    // Build filter
    const baseFilter = {
      ownerId: userId,
      ...dateFilter,
    };

    if (itemType) {
      baseFilter.itemType = itemType;
    }

    if (itemId) {
      baseFilter.itemId = itemId;
    }

    if (eventType) {
      baseFilter.eventType = eventType;
    }

    // Determine date grouping format
    let dateFormat;
    if (groupBy === "hour") {
      dateFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
        hour: { $hour: "$createdAt" },
      };
    } else if (groupBy === "week") {
      dateFormat = {
        year: { $year: "$createdAt" },
        week: { $week: "$createdAt" },
      };
    } else if (groupBy === "month") {
      dateFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
    } else {
      // Default to day
      dateFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
    }

    // Aggregate time series data
    const timeSeriesData = await AnalyticsEvent.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: {
            date: dateFormat,
            eventType: "$eventType",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ]);

    // Format data for charts
    const formattedData = {};
    timeSeriesData.forEach((item) => {
      const dateKey =
        groupBy === "hour"
          ? `${item._id.date.year}-${String(item._id.date.month).padStart(2, "0")}-${String(item._id.date.day).padStart(2, "0")} ${String(item._id.date.hour).padStart(2, "0")}:00`
          : groupBy === "week"
            ? `${item._id.date.year}-W${String(item._id.date.week).padStart(2, "0")}`
            : groupBy === "month"
              ? `${item._id.date.year}-${String(item._id.date.month).padStart(2, "0")}`
              : `${item._id.date.year}-${String(item._id.date.month).padStart(2, "0")}-${String(item._id.date.day).padStart(2, "0")}`;

      if (!formattedData[dateKey]) {
        formattedData[dateKey] = {
          date: dateKey,
          views: 0,
          clicks: 0,
          chatsStarted: 0,
          messagesSent: 0,
          messagesReceived: 0,
        };
      }

      // Map event type to property name
      let eventProperty;
      switch (item._id.eventType) {
        case "view":
          eventProperty = "views";
          break;
        case "click":
          eventProperty = "clicks";
          break;
        case "chat_started":
          eventProperty = "chatsStarted";
          break;
        case "message_sent":
          eventProperty = "messagesSent";
          break;
        case "message_received":
          eventProperty = "messagesReceived";
          break;
        default:
          // Skip unknown event types - return early from forEach callback
          return;
      }
      if (eventProperty) {
        formattedData[dateKey][eventProperty] = item.count;
      }
    });

    const result = Object.values(formattedData).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return res.status(200).json({
      message: "Time series data retrieved successfully",
      data: result,
      groupBy,
    });
  } catch (error) {
    console.error("getTimeSeriesData error", error);
    return res
      .status(500)
      .json({ message: "Failed to retrieve time series data" });
  }
};

// Get top performing items
export const getTopItems = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      startDate,
      endDate,
      itemType,
      limit = 10,
      metric = "views",
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // Build filter
    const baseFilter = {
      ownerId: userId,
      ...dateFilter,
    };

    if (itemType) {
      baseFilter.itemType = itemType;
      baseFilter.eventType = metric;
    }

    // Aggregate top items
    const topItems = await AnalyticsEvent.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: {
            itemId: "$itemId",
            itemType: "$itemType",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    // Populate item details
    const itemsWithDetails = await Promise.all(
      topItems.map(async (item) => {
        let itemDetails = null;
        if (item._id.itemType === "product") {
          itemDetails = await Product.findById(item._id.itemId).select(
            "name images price rating",
          );
        } else {
          itemDetails = await Property.findById(item._id.itemId).select(
            "title images price rating",
          );
        }

        return {
          itemId: item._id.itemId,
          itemType: item._id.itemType,
          count: item.count,
          name: itemDetails?.name || itemDetails?.title || "Unknown",
          image: itemDetails?.images?.[0] || null,
          price: itemDetails?.price || null,
          rating: itemDetails?.rating || null,
        };
      }),
    );

    return res.status(200).json({
      message: "Top items retrieved successfully",
      items: itemsWithDetails,
    });
  } catch (error) {
    console.error("getTopItems error", error);
    return res.status(500).json({ message: "Failed to retrieve top items" });
  }
};

// Get response time trends
export const getResponseTimeTrends = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate, groupBy = "day" } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    } else {
      // Default to last 30 days
      const defaultEndDate = new Date();
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 30);
      dateFilter.createdAt = {
        $gte: defaultStartDate,
        $lte: defaultEndDate,
      };
    }

    // Determine date grouping format
    let dateFormat;
    if (groupBy === "hour") {
      dateFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
        hour: { $hour: "$createdAt" },
      };
    } else if (groupBy === "week") {
      dateFormat = {
        year: { $year: "$createdAt" },
        week: { $week: "$createdAt" },
      };
    } else if (groupBy === "month") {
      dateFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
    } else {
      dateFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
    }

    // Aggregate response times
    const responseTimeData = await AnalyticsEvent.aggregate([
      {
        $match: {
          ownerId: userId,
          eventType: "message_received",
          responseTime: { $ne: null, $gt: 0 },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: {
            date: dateFormat,
          },
          avgResponseTime: { $avg: "$responseTime" },
          minResponseTime: { $min: "$responseTime" },
          maxResponseTime: { $max: "$responseTime" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ]);

    // Format data
    const formattedData = responseTimeData.map((item) => {
      const dateKey =
        groupBy === "hour"
          ? `${item._id.date.year}-${String(item._id.date.month).padStart(2, "0")}-${String(item._id.date.day).padStart(2, "0")} ${String(item._id.date.hour).padStart(2, "0")}:00`
          : groupBy === "week"
            ? `${item._id.date.year}-W${String(item._id.date.week).padStart(2, "0")}`
            : groupBy === "month"
              ? `${item._id.date.year}-${String(item._id.date.month).padStart(2, "0")}`
              : `${item._id.date.year}-${String(item._id.date.month).padStart(2, "0")}-${String(item._id.date.day).padStart(2, "0")}`;

      return {
        date: dateKey,
        avgResponseTimeMinutes: Math.round(item.avgResponseTime / 1000 / 60), // Convert to minutes
        minResponseTimeMinutes: Math.round(item.minResponseTime / 1000 / 60),
        maxResponseTimeMinutes: Math.round(item.maxResponseTime / 1000 / 60),
        count: item.count,
      };
    });

    return res.status(200).json({
      message: "Response time trends retrieved successfully",
      data: formattedData,
      groupBy,
    });
  } catch (error) {
    console.error("getResponseTimeTrends error", error);
    return res
      .status(500)
      .json({ message: "Failed to retrieve response time trends" });
  }
};
