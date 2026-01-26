#!/bin/bash

# 🚀 QUICK START - Aurora Tracker on Azure
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
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-aurora-tracker-rg}"
APP_NAME="${AZURE_APP_NAME:-aurora-tracker}"
PLAN_NAME="${AZURE_APP_PLAN:-${APP_NAME}-plan}"
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
█          🌌 Aurora Tracker - Azure Deploy 🌌          █
█                                                          █
████████████████████████████████████████████████████████████

🚀 Deploying Aurora Tracker to Azure...

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
echo "  SKU:            Prefer F1 (Free), fallback B1"
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
    for TRY_LOCATION in "${LOCATION_CANDIDATES[@]}"; do
        for TRY_SKU in F1 B1; do
            run_cmd "Create App Service Plan (SKU: ${TRY_SKU}, Location: ${TRY_LOCATION})" az appservice plan create \
                --name "$PLAN_NAME" \
                --resource-group "$RESOURCE_GROUP" \
                --location "$TRY_LOCATION" \
                --sku "$TRY_SKU" \
                --is-linux
            RESULT=$?
            if [ $RESULT -eq 0 ]; then
                SKU="$TRY_SKU"
                LOCATION="$TRY_LOCATION"
                echo "✅ App Service Plan created (SKU: $SKU)"
                break 2
            fi
            echo "⚠️  SKU $TRY_SKU unavailable in $TRY_LOCATION, trying next..."
        done
        echo "⚠️  Location $TRY_LOCATION unavailable for plan, trying next..."
    done
    set -e
    if [ -z "$SKU" ]; then
        echo "❌ Failed to create App Service Plan with F1 or B1"
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
if [ "$APP_STATE" = "QuotaExceeded" ] && [ "$SKU" = "F1" ]; then
    echo "⚠️  Free tier quota exceeded. Upgrading plan to B1..."
    if ! run_cmd "Upgrade plan to B1" az appservice plan update --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" --sku B1; then
        echo "❌ Failed to upgrade plan to B1"
        exit 1
    fi
    SKU="B1"
    echo "✅ Plan upgraded to B1"
fi
echo ""

echo "5️⃣  Configuring Node.js settings..."
if ! run_cmd "Set Node.js runtime" az webapp config set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --linux-fx-version "NODE|22-lts"; then
    echo "❌ Failed to set Node.js runtime"
    exit 1
fi
if ! run_cmd "Configure app settings" az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --settings NODE_ENV=production PORT=8080 SCM_DO_BUILD_DURING_DEPLOYMENT=true; then
    echo "❌ Failed to configure app settings"
    exit 1
fi
echo "✅ App settings configured"
echo ""

echo "6️⃣  Ensuring app is running..."
az webapp start --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" > /dev/null 2>&1 || true
echo "✅ App start requested"
echo ""

echo "7️⃣  Preparing and deploying code..."
echo "   Creating zip package (excluding .git, node_modules, .env)"
TEMP_ZIP="/tmp/northern-lights-${APP_NAME}.zip"
if ! run_cmd "Create deployment package" zip -r "$TEMP_ZIP" . -x ".git/*" "node_modules/*" ".env"; then
    echo "❌ Failed to create deployment package"
    exit 1
fi

DEPLOY_RESULT=""
DEPLOY_OK=0
for ATTEMPT in 1 2 3; do
    echo "   Deploy attempt ${ATTEMPT}/3..."
    DEPLOY_RESULT=$(az webapp deployment source config-zip \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME" \
        --src "$TEMP_ZIP" 2>&1)
    if [ $? -eq 0 ]; then
        DEPLOY_OK=1
        break
    fi
    APP_STATE=$(az webapp show --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --query state -o tsv 2>/dev/null)
    if [ "$APP_STATE" = "QuotaExceeded" ] && [ "$SKU" = "F1" ]; then
        echo "   ⚠️  Free tier quota exceeded. Upgrading plan to B1..."
        if ! run_cmd "Upgrade plan to B1" az appservice plan update --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" --sku B1; then
            echo "   ❌ Failed to upgrade plan to B1"
            break
        fi
        SKU="B1"
        echo "   ✅ Plan upgraded to B1"
        az webapp start --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" > /dev/null 2>&1 || true
    fi
    echo "   ⚠️  Deploy attempt ${ATTEMPT} failed, retrying in 10s..."
    sleep 10
done
if [ $DEPLOY_OK -ne 1 ]; then
    echo "❌ Failed to deploy code"
    echo "Error details:"
    echo "$DEPLOY_RESULT"
    rm -f "$TEMP_ZIP"
    exit 1
fi

rm -f "$TEMP_ZIP"
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

# Upload environment settings if .env exists and email is configured
if [ -f ".env" ]; then
    if [ "$EMAIL_ENABLED" = "true" ] && [ -n "$SMTP_USER" ] && [ -n "$SMTP_PASS" ]; then
        echo "📧 Uploading email settings to Azure..."
        run_cmd "Upload email settings" az webapp config appsettings set \
            --resource-group "$RESOURCE_GROUP" \
            --name "$APP_NAME" \
            --settings \
                EMAIL_ENABLED="${EMAIL_ENABLED:-false}" \
                SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}" \
                SMTP_PORT="${SMTP_PORT:-587}" \
                SMTP_USER="$SMTP_USER" \
                SMTP_PASS="$SMTP_PASS" \
                FROM_EMAIL="${FROM_EMAIL:-$SMTP_USER}" \
                EMAIL_RECIPIENTS="${EMAIL_RECIPIENTS:-}" \
                EMAIL_COOLDOWN="${EMAIL_COOLDOWN:-60}" \
                ALERT_LATITUDE="${ALERT_LATITUDE:-47.6}" \
                ALERT_LONGITUDE="${ALERT_LONGITUDE:--122.3}" \
                ALERT_LOCATION_NAME="${ALERT_LOCATION_NAME:-Seattle, WA}"
        if [ $? -eq 0 ]; then
            echo "✅ Email settings uploaded!"
        else
            echo "⚠️  Failed to upload email settings (you can do it manually in Azure Portal)"
        fi
        echo ""
    else
        echo "ℹ️  Email not configured in .env (EMAIL_ENABLED=false or missing credentials)"
        echo "   Edit .env to enable email notifications"
        echo ""
    fi
fi

echo "📝 Useful Commands:"
echo "  View logs:     az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo "  Stop app:      az webapp stop --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo "  Delete all:    az group delete --name $RESOURCE_GROUP"
echo "  Restart app:   az webapp restart --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo ""
echo "  Upload env:    Run this script again (reads from .env)"
echo ""

exit 0
