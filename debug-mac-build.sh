#!/bin/bash

echo "🔧 Debug Mac Build Script"
echo "========================="

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is for macOS only"
    exit 1
fi

echo "🖥️ Platform: $(uname -s)"
echo "🏗️ Architecture: $(uname -m)"
echo "📁 Current directory: $(pwd)"

# Check Node.js version
echo "🟢 Node.js version: $(node --version)"
echo "📦 npm version: $(npm --version)"

# Check if .next directory exists
if [ -d ".next" ]; then
    echo "✅ .next directory exists"
    echo "📁 .next contents:"
    ls -la .next/
    
    if [ -d ".next/standalone" ]; then
        echo "✅ .next/standalone exists"
        echo "📁 Standalone contents:"
        ls -la .next/standalone/
        
        if [ -f ".next/standalone/server.js" ]; then
            echo "✅ server.js exists"
            echo "📄 server.js size: $(wc -c < .next/standalone/server.js) bytes"
        else
            echo "❌ server.js missing!"
        fi
    else
        echo "❌ .next/standalone missing!"
    fi
else
    echo "❌ .next directory missing! Running build..."
    npm run build
fi

# Check if electron directory exists
if [ -d "electron" ]; then
    echo "✅ electron directory exists"
    echo "📁 Electron contents:"
    ls -la electron/
    
    if [ -f "electron/main.js" ]; then
        echo "✅ main.js exists"
        echo "📄 main.js size: $(wc -c < electron/main.js) bytes"
    else
        echo "❌ main.js missing!"
    fi
else
    echo "❌ electron directory missing!"
fi

# Test the standalone server
echo ""
echo "🧪 Testing standalone server..."
if [ -f ".next/standalone/server.js" ]; then
    echo "🚀 Starting server on port 3000..."
    cd .next/standalone
    
    # Load environment variables
    if [ -f "../../.env.local" ]; then
        echo "📋 Loading environment variables..."
        export $(cat ../../.env.local | grep -v '^#' | xargs)
    fi
    
    # Start server in background
    PORT=3000 NODE_ENV=production node server.js &
    SERVER_PID=$!
    sleep 5
    
    echo "📡 Testing server response..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Server responds with 200 OK"
    else
        echo "❌ Server not responding (HTTP $HTTP_CODE)"
        
        # Check if server process is still running
        if kill -0 $SERVER_PID 2>/dev/null; then
            echo "ℹ️ Server process is running but not responding"
        else
            echo "❌ Server process has died"
        fi
    fi
    
    # Kill the server
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    cd ../..
else
    echo "❌ Cannot test server - server.js not found"
fi

echo ""
echo "🔍 Environment check:"
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL:-not set}"

echo ""
echo "✅ Debug complete. Now try running:"
echo "   npm run electron:build:mac"
echo "   or"
echo "   npm run dev"