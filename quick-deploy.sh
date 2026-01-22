#!/bin/bash

# 🚀 QUICK START - Northern Lights Reporter on Azure
# Just run this file!

cat << 'EOF'

████████████████████████████████████████████████████████████
█                                                          █
█     🌌 Northern Lights Reporter - Azure Deploy 🌌     █
█                                                          █
████████████████████████████████████████████████████████████

🚀 Deploying Northern Lights Reporter to Azure...

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

cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

# Configuration
RESOURCE_GROUP="northern-lights-reporter-rg"
APP_NAME="northern-lights-reporter"
PLAN_NAME="${APP_NAME}-plan"
LOCATION="canadacentral"
SKU=""

echo "📦 Deployment Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  App Name:       $APP_NAME"
echo "  Location:       $LOCATION"
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
else
    if ! az group create --name "$RESOURCE_GROUP" --location "$LOCATION" > /dev/null 2>&1; then
        echo "❌ Failed to create resource group"
        exit 1
    fi
    echo "✅ Resource group created"
fi
echo ""

echo "2️⃣  Creating App Service Plan..."
if az appservice plan show --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" > /dev/null 2>&1; then
    SKU=$(az appservice plan show --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" --query sku.name -o tsv 2>/dev/null)
    echo "✅ App Service Plan already exists (SKU: ${SKU:-unknown})"
else
    set +e
    for TRY_SKU in F1 B1; do
        az appservice plan create \
            --name "$PLAN_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --sku "$TRY_SKU" \
            --is-linux > /dev/null 2>&1
        RESULT=$?
        if [ $RESULT -eq 0 ]; then
            SKU="$TRY_SKU"
            echo "✅ App Service Plan created (SKU: $SKU)"
            break
        fi
        echo "⚠️  SKU $TRY_SKU unavailable, trying next..."
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
    if ! az appservice plan update --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" --sku B1 > /dev/null 2>&1; then
        echo "❌ Failed to upgrade plan to B1"
        exit 1
    fi
    SKU="B1"
    echo "✅ Plan upgraded to B1"
fi
echo ""

echo "5️⃣  Configuring Node.js settings..."
if ! az webapp config set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --linux-fx-version "NODE|22-lts" > /dev/null 2>&1; then
    echo "❌ Failed to set Node.js runtime"
    exit 1
fi
if ! az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --settings NODE_ENV=production PORT=8080 SCM_DO_BUILD_DURING_DEPLOYMENT=true > /dev/null 2>&1; then
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
if ! zip -r "$TEMP_ZIP" . -x ".git/*" "node_modules/*" ".env" > /dev/null 2>&1; then
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
        if ! az appservice plan update --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" --sku B1 > /dev/null 2>&1; then
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
echo "📝 Useful Commands:"
echo "  View logs:     az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo "  Stop app:      az webapp stop --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo "  Delete all:    az group delete --name $RESOURCE_GROUP"
echo "  Restart app:   az webapp restart --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo ""

exit 0
