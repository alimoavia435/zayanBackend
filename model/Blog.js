import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      default: "",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    featuredImage: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    metaTitle: {
      type: String,
      default: null,
    },
    metaDescription: {
      type: String,
      default: null,
    },
    metaKeywords: {
      type: [String],
      default: [],
    },
    views: {
      type: Number,
      default: 0,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Generate slug from title before saving
blogSchema.pre("save", async function () {
  if (this.isModified("title") && !this.slug) {
    let baseSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug
    while (await mongoose.model("Blog").findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }
});

// Update publishedAt when status changes to published
blogSchema.pre("save", async function () {
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

// Index for efficient queries
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ slug: 1 });
blogSchema.index({ isFeatured: 1, status: 1 });

const Blog = mongoose.model("Blog", blogSchema);

export default Blog;

