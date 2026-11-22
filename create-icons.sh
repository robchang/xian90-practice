#!/bin/bash

# Create simple placeholder icons using ImageMagick if available
# Otherwise create minimal SVG placeholders

if command -v convert &> /dev/null; then
  # Use ImageMagick
  convert -size 192x192 xc:'#8B0000' \
    -gravity center \
    -pointsize 80 -fill '#FFFEF0' -font "Noto-Serif-SC" -annotate +0+0 '西' \
    public/icon-192.png

  convert -size 512x512 xc:'#8B0000' \
    -gravity center \
    -pointsize 220 -fill '#FFFEF0' -font "Noto-Serif-SC" -annotate +0+0 '西' \
    public/icon-512.png
else
  # Create SVG placeholders
  cat > public/icon-192.svg << 'SVGEOF'
<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="192" fill="#8B0000"/>
  <text x="96" y="120" font-family="serif" font-size="80" fill="#FFFEF0" text-anchor="middle">西</text>
</svg>
SVGEOF

  cat > public/icon-512.svg << 'SVGEOF'
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#8B0000"/>
  <text x="256" y="320" font-family="serif" font-size="220" fill="#FFFEF0" text-anchor="middle">西</text>
</svg>
SVGEOF
  
  echo "Created SVG icons (convert to PNG manually if needed)"
fi
