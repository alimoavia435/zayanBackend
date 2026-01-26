export const searchLocation = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res
        .status(400)
        .json({ success: false, message: "Query parameter 'q' is required" });
    }

    // Proxy request to OpenStreetMap Nominatim API
    // Must provide a valid User-Agent as per their usage policy
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
      {
        headers: {
          "User-Agent": "ZayanRealEstatePlatform/1.0 (contact@zayan.com)",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`OSM API Error: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Location search error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch location data" });
  }
};
