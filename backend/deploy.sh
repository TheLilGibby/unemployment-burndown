#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# Deploy the Financial Burndown backend to AWS
# ─────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  Financial Burndown — Backend Deployer"
echo "=========================================="
echo ""

# ── Step 1: Check for SAM CLI ──
if ! command -v sam &> /dev/null; then
  echo -e "${RED}SAM CLI is not installed.${NC}"
  echo ""
  echo "Install it with one of these:"
  echo ""
  echo "  Mac:     brew install aws-sam-cli"
  echo "  Windows: winget install Amazon.SAM-CLI"
  echo "  Linux:   pip install aws-sam-cli"
  echo ""
  echo "Or download from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
  echo ""
  exit 1
fi
echo -e "${GREEN}SAM CLI found:${NC} $(sam --version)"

# ── Step 2: Check for AWS credentials ──
if ! aws sts get-caller-identity &> /dev/null 2>&1; then
  echo -e "${RED}AWS credentials not configured.${NC}"
  echo ""
  echo "Run:  aws configure"
  echo "You'll need your AWS Access Key ID and Secret Access Key."
  echo ""
  exit 1
fi
echo -e "${GREEN}AWS credentials OK${NC}"
echo ""

# ── Step 3: Build ──
echo "Building Lambda functions..."
sam build
echo ""

# ── Step 4: Deploy ──
echo -e "${YELLOW}Starting guided deployment...${NC}"
echo ""
echo "When prompted, use these recommended values:"
echo "  Stack Name:              burndown-backend"
echo "  Region:                  us-west-1"
echo "  PlaidClientId:           (your Plaid client ID, or 'placeholder' for now)"
echo "  PlaidSecret:             (your Plaid secret, or 'placeholder' for now)"
echo "  JwtSecret:               (a long random string — e.g. run: openssl rand -hex 32)"
echo "  AllowedOrigin:           * (or your Amplify domain for production)"
echo "  Confirm deploy:          y"
echo "  Allow SAM to create IAM: y"
echo "  Save to samconfig.toml:  y"
echo ""

sam deploy --guided

echo ""
echo "=========================================="
echo -e "${GREEN}  Deployment complete!${NC}"
echo "=========================================="
echo ""
echo "Copy the ApiUrl value above and paste it into:"
echo "  Amplify Console > Your App > Environment variables"
echo "  Variable name:  VITE_PLAID_API_URL"
echo "  Variable value: (the ApiUrl from above)"
echo ""
echo "Then trigger a new Amplify build to pick up the change."
echo ""
