#!/bin/bash

# 🚀 QUICK START - Aurora on Azure
# Just run this file!

cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

# Run a command and surface full error output on failure.
run_cmd() {
    local desc="$1"
    shift
    local output
    output=$("$@" 2>&1)
    local status=$?
    if [ $status -ne 0 ]; then
        echo "❌ ${desc} failed (exit ${status})"
        echo "Error details:"
        echo "$output"
        return $status
    fi
    return 0
}

# Load .env file if exists
if [ -f ".env" ]; then
    echo "📂 Found .env file, loading configuration..."
    set -a
    source .env
    set +a
else
    echo "⚠️  No .env file found. Using defaults or Azure settings."
    echo "   Create .env from .env.example for email notifications"
fi

# Configuration (from .env or defaults)
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-nocturne-rg}"
APP_NAME="${AZURE_APP_NAME:-nocturne}"
PLAN_NAME="${AZURE_APP_PLAN:-nocturne-plan}"
LOCATION="${AZURE_LOCATION:-}"

# Location preference: try preferred first, then US-first defaults
DEFAULT_LOCATIONS=(eastus westus2 centralus eastus2 northcentralus canadacentral westeurope)
if [ -z "$LOCATION" ]; then
    LOCATION_CANDIDATES=("${DEFAULT_LOCATIONS[@]}")
    LOCATION_LABEL="auto (US-first)"
else
    LOCATION_CANDIDATES=("$LOCATION")
    for LOC in "${DEFAULT_LOCATIONS[@]}"; do
        if [ "$LOC" != "$LOCATION" ]; then
            LOCATION_CANDIDATES+=("$LOC")
        fi
    done
    LOCATION_LABEL="$LOCATION (preferred)"
fi

cat << 'EOF'

████████████████████████████████████████████████████████████
█                                                          █
█         🌙 Nocturne - Azure Deploy 🌙                 █
█          Your 24x7 Personal Assistant                  █
█                                                          █
████████████████████████████████████████████████████████████

🚀 Deploying Nocturne to Azure...

EOF

echo ""
echo "Checking prerequisites..."

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found!"
    echo ""
    echo "Install it with:"
    echo "  macOS:  brew install azure-cli"
    echo "  Ubuntu: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
    echo "  Other:  https://learn.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

echo "✅ Azure CLI found"
az --version | head -n 1
echo ""
echo "🚀 Starting deployment..."
echo ""

SKU=""

echo "📦 Deployment Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  App Name:       $APP_NAME"
echo "  Location:       $LOCATION_LABEL"
echo "  Plan Name:      $PLAN_NAME"
echo "  SKU:            B1 (Basic - 24x7 Always On)"
echo ""

echo "📝 Checking Azure authentication..."
if ! az account show > /dev/null 2>&1; then
    echo "📝 Need to log in to Azure..."
    az login || {
        echo "❌ Azure login failed"
        exit 1
    }
fi
ACCOUNT_NAME=$(az account show --query name -o tsv 2>/dev/null)
ACCOUNT_SUB=$(az account show --query id -o tsv 2>/dev/null)
ACCOUNT_TENANT=$(az account show --query tenantId -o tsv 2>/dev/null)
echo "✅ Logged in successfully"
echo "   Subscription: ${ACCOUNT_NAME:-unknown} (${ACCOUNT_SUB:-unknown})"
echo "   Tenant: ${ACCOUNT_TENANT:-unknown}"
echo ""

echo "1️⃣  Creating resource group..."
if az group exists --name "$RESOURCE_GROUP" 2>/dev/null | grep -q true; then
    echo "✅ Resource group already exists"
    if [ -z "$LOCATION" ]; then
        LOCATION=$(az group show --name "$RESOURCE_GROUP" --query location -o tsv 2>/dev/null)
        if [ -n "$LOCATION" ]; then
            LOCATION_LABEL="${LOCATION} (existing RG)"
        fi
    fi
else
    CREATED=0
    for TRY_LOCATION in "${LOCATION_CANDIDATES[@]}"; do
        if run_cmd "Create resource group in ${TRY_LOCATION}" az group create --name "$RESOURCE_GROUP" --location "$TRY_LOCATION"; then
            LOCATION="$TRY_LOCATION"
            CREATED=1
            echo "✅ Resource group created (${LOCATION})"
            break
        fi
        echo "⚠️  Location $TRY_LOCATION unavailable, trying next..."
    done
    if [ $CREATED -ne 1 ]; then
        echo "❌ Failed to create resource group in preferred locations"
        exit 1
    fi
fi
echo ""

echo "2️⃣  Creating App Service Plan..."
if az appservice plan show --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" > /dev/null 2>&1; then
    SKU=$(az appservice plan show --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" --query sku.name -o tsv 2>/dev/null)
    echo "✅ App Service Plan already exists (SKU: ${SKU:-unknown})"
else
    set +e
    # Use B1 (Basic) for 24x7 Always On support - try different locations if quota exceeded
    for TRY_LOCATION in "${LOCATION_CANDIDATES[@]}"; do
        run_cmd "Create App Service Plan (SKU: B1, Location: ${TRY_LOCATION})" az appservice plan create \
            --name "$PLAN_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$TRY_LOCATION" \
            --sku "B1" \
            --is-linux
        RESULT=$?
        if [ $RESULT -eq 0 ]; then
            SKU="B1"
            LOCATION="$TRY_LOCATION"
            echo "✅ App Service Plan created (SKU: B1 - Always On enabled)"
            break
        fi
        echo "⚠️  B1 unavailable in $TRY_LOCATION, trying next location..."
    done
    set -e
    if [ -z "$SKU" ]; then
        echo "❌ Failed to create App Service Plan with B1 in any location"
        echo "   You may have reached the B1 quota limit for your subscription."
        echo "   Try a different Azure region or subscription."
        exit 1
    fi
fi
echo ""

echo "3️⃣  Creating Web App..."
echo "   Runtime: NODE:22-lts"
CREATE_RESULT=$(az webapp create \
    --resource-group "$RESOURCE_GROUP" \
    --plan "$PLAN_NAME" \
    --name "$APP_NAME" \
    --runtime "NODE:22-lts" 2>&1)

if [ $? -ne 0 ]; then
    if ! az webapp show --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" > /dev/null 2>&1; then
        echo "❌ Web App creation failed"
        echo "Error details:"
        echo "$CREATE_RESULT"
        exit 1
    fi
else
    echo "✅ Web App created successfully"
fi
echo "✅ Web App ready"
echo ""

echo "4️⃣  Verifying app state..."
APP_STATE=$(az webapp show --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --query state -o tsv 2>/dev/null)
echo "   Current state: ${APP_STATE:-unknown}"
echo ""

echo "5️⃣  Configuring Node.js settings..."
if ! run_cmd "Set Node.js runtime" az webapp config set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --linux-fx-version "NODE|22-lts"; then
    echo "❌ Failed to set Node.js runtime"
    exit 1
fi

# Enable Always On for 24x7 uptime (requires Basic tier or higher)
echo "   Enabling Always On for 24x7 uptime..."
if ! run_cmd "Enable Always On" az webapp config set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --always-on true; then
    echo "⚠️  Could not enable Always On (may require Basic tier or higher)"
fi

# Build app settings from .env file
APP_SETTINGS="NODE_ENV=production PORT=8080 SCM_DO_BUILD_DURING_DEPLOYMENT=true"

if [ -f ".env" ]; then
    echo "   Loading settings from .env file..."
    
    # List of settings to transfer to Azure (excluding AZURE_* deployment settings)
    ENV_VARS=(
        "EMAIL_ENABLED"
        "SMTP_HOST"
        "SMTP_PORT"
        "SMTP_USER"
        "SMTP_PASS"
        "FROM_EMAIL"
        "EMAIL_RECIPIENTS"
        "EMAIL_COOLDOWN"
        "ALERT_LATITUDE"
        "ALERT_LONGITUDE"
        "ALERT_LOCATION_NAME"
        "STOCKS_ENABLED"
        "STOCKS_WATCHLIST"
        "STOCKS_ALERT_THRESHOLD"
        "ALPHA_VANTAGE_API_KEY"
        "FINNHUB_API_KEY"
        "NEWS_ENABLED"
        "NEWSAPI_KEY"
        "NEWS_CATEGORIES"
        "NEWS_KEYWORDS"
        "AURORA_ENABLED"
    )
    
    for VAR in "${ENV_VARS[@]}"; do
        VALUE="${!VAR}"
        if [ -n "$VALUE" ]; then
            # Escape special characters for Azure CLI
            ESCAPED_VALUE=$(echo "$VALUE" | sed 's/"/\\"/g')
            APP_SETTINGS="$APP_SETTINGS $VAR=\"$ESCAPED_VALUE\""
        fi
    done
fi

echo "   Applying app settings to Azure..."
if ! eval "run_cmd \"Configure app settings\" az webapp config appsettings set \
    --resource-group \"$RESOURCE_GROUP\" \
    --name \"$APP_NAME\" \
    --settings $APP_SETTINGS"; then
    echo "❌ Failed to configure app settings"
    exit 1
fi
echo "✅ App settings configured (Always On enabled)"
echo ""

echo "6️⃣  Ensuring app is running..."
az webapp start --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" > /dev/null 2>&1 || true
echo "✅ App start requested"
echo ""

echo "7️⃣  Deploying code with az webapp up..."
echo "   This handles npm install and deployment automatically"

DEPLOY_RESULT=""
DEPLOY_OK=0
for ATTEMPT in 1 2 3; do
    echo "   Deploy attempt ${ATTEMPT}/3..."
    DEPLOY_RESULT=$(az webapp up \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --plan "$PLAN_NAME" \
        --runtime "NODE:22-lts" \
        --sku "$SKU" 2>&1)
    if [ $? -eq 0 ]; then
        DEPLOY_OK=1
        break
    fi
    echo "   ⚠️  Deploy attempt ${ATTEMPT} failed, retrying in 10s..."
    sleep 10
done
if [ $DEPLOY_OK -ne 1 ]; then
    echo "❌ Failed to deploy code"
    echo "Error details:"
    echo "$DEPLOY_RESULT"
    exit 1
fi

echo "✅ Code deployed"
echo ""

echo "⏳ Waiting for app to start (this may take 30-60 seconds)..."
sleep 10

APP_URL=$(az webapp show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --query defaultHostName \
    --output tsv 2>/dev/null)

if [ -z "$APP_URL" ]; then
    APP_URL="${APP_NAME}.azurewebsites.net"
fi

if [[ ! "$APP_URL" =~ ^https?:// ]]; then
    APP_URL="https://${APP_URL}"
fi

echo ""
echo "════════════════════════════════════════════"
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "════════════════════════════════════════════"
echo ""
echo "🌐 Your app is live at:"
echo "$APP_URL"
echo ""
echo "📊 Management:"
echo "  Azure Portal: https://portal.azure.com"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  App Name: $APP_NAME"
echo ""

# Show which settings were applied
if [ -f ".env" ]; then
    echo "📋 Applied Settings from .env:"
    [ "$EMAIL_ENABLED" = "true" ] && echo "   ✅ Email notifications: ENABLED (${EMAIL_RECIPIENTS:-no recipients})"
    [ "$EMAIL_ENABLED" != "true" ] && echo "   ⚪ Email notifications: DISABLED"
    [ "$STOCKS_ENABLED" = "true" ] && echo "   ✅ Stocks module: ENABLED"
    [ "$NEWS_ENABLED" = "true" ] && echo "   ✅ News module: ENABLED"
    [ -n "$ALERT_LATITUDE" ] && echo "   📍 Alert location: ${ALERT_LOCATION_NAME:-$ALERT_LATITUDE, $ALERT_LONGITUDE}"
    echo ""
else
    echo "ℹ️  No .env file found - using default settings"
    echo "   Create .env from .env.example to customize"
    echo ""
fi

echo "📝 Useful Commands:"
echo "  View logs:     az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo "  Stop app:      az webapp stop --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo "  Delete all:    az group delete --name $RESOURCE_GROUP"
echo "  Restart app:   az webapp restart --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo ""
echo "  Update settings: Edit .env and run this script again"
echo ""

exit 0
