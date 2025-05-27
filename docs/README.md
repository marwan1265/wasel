# Wasel v2 Documentation

Welcome to the Wasel v2 documentation. This directory contains comprehensive documentation for various aspects of the application.

## 📚 Documentation Index

### Core Documentation

- **[Configuration Guide](./CONFIGURATION.md)** - Complete guide for configuring Wasel v2, including:
  - Chat history storage (Redis/Upstash)
  - Search providers (SearXNG setup)
  - AI model providers and API keys
  - Feature toggles

- **[Rate Limiting System](./RATE_LIMITING.md)** - Comprehensive documentation for the rate limiting system:
  - Architecture and implementation
  - API usage and configuration
  - Testing and deployment
  - Troubleshooting guide



## 🚀 Quick Start

1. **Configuration**: Start with the [Configuration Guide](./CONFIGURATION.md) to set up your environment
2. **Rate Limiting**: Review the [Rate Limiting System](./RATE_LIMITING.md) documentation to understand API limits
3. **Testing**: Check the test documentation to understand how to verify your setup

## 📖 Documentation Standards

All documentation in this directory follows these standards:

- **Markdown Format**: All docs use GitHub-flavored Markdown
- **Clear Structure**: Each document has a table of contents and clear sections
- **Code Examples**: Practical examples with syntax highlighting
- **Version Tracking**: Documents are updated with each major change

## 🔄 Keeping Documentation Updated

When making changes to the codebase:

1. Update relevant documentation files
2. Add new documentation for new features
3. Archive old documentation if needed
4. Update this README with new document links

## 📝 Contributing to Documentation

To contribute to the documentation:

1. Follow the existing format and structure
2. Include code examples where applicable
3. Test all code examples before documenting
4. Update the table of contents when adding sections
5. Link between related documents

## 🏗️ Documentation Structure

```
docs/
├── README.md                      # This file - main documentation index
├── CONFIGURATION.md               # Application configuration guide
└── RATE_LIMITING.md              # Comprehensive rate limiting documentation
```

## 🔍 Finding Information

- **For setup instructions**: See [CONFIGURATION.md](./CONFIGURATION.md)
- **For API rate limits**: See [RATE_LIMITING.md](./RATE_LIMITING.md)
- **For testing**: See the Testing section in [RATE_LIMITING.md](./RATE_LIMITING.md#testing)
- **For troubleshooting**: Check the Troubleshooting sections in relevant docs

## 📞 Support

If you can't find what you're looking for in the documentation:

1. Check the code comments in the relevant files
2. Review the test files for usage examples
3. Open an issue with the documentation label

---

Last updated: December 2024 