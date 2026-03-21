#!/bin/bash
#
# Botón Médico Smart Bot Engine - Quick Simulation Script
# Runs comprehensive demonstration of all 4 optimization points
#
# Usage: ./RUN_SIMULATION.sh
#

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🏥 BOTÓN MÉDICO - SMART BOT ENGINE SIMULATION                ║"
echo "║                                                                ║"
echo "║  Running 5 real conversation scenarios demonstrating:          ║"
echo "║  • Instant Campaign Response                                  ║"
echo "║  • Automatic Lead Qualification                               ║"
echo "║  • Medical Advisory AI                                        ║"
echo "║  • Smart Routing & Intent Classification                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Navigate to server directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/apps/server"

echo "📁 Working directory: $(pwd)"
echo ""

# Check if ts-node is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js"
    exit 1
fi

echo "🚀 Starting simulation..."
echo ""
echo "This will run 5 scenarios:"
echo "  1. Campaign Response + Lead Qualification (Facebook)"
echo "  2. Medical Inquiry with Clinical Rules (WhatsApp)"
echo "  3. Price Request with Volume Intelligence (Instagram)"
echo "  4. Complaint - Critical Escalation (WhatsApp)"
echo "  5. B2B Distributor Lead (Messenger)"
echo ""
echo "────────────────────────────────────────────────────────────────"
echo ""

# Run the simulation
npx ts-node src/simulation.ts

echo ""
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "✅ Simulation complete!"
echo ""
echo "📊 Summary:"
echo "  • 5 scenarios executed"
echo "  • All 4 optimization points demonstrated"
echo "  • Real seed data used (no database required)"
echo "  • Actual bot response times simulated"
echo ""
echo "📁 Data files used:"
echo "  • medical-products-seed.ts"
echo "  • clinical-rules-seed.ts"
echo "  • qualification-flows.ts"
echo "  • smart-bot-engine.ts"
echo ""
echo "📖 For details, see: SIMULATION.md"
echo ""
