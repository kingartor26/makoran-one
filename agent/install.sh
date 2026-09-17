#!/usr/bin/env bash
# ==============================================================================
# MAKORAN AGENT — LINUX MINI PC INSTALLATION SCRIPT
# Recommended Hardware: Intel N100 / N95, 8GB RAM, Gigabit Ethernet, Ubuntu/Debian
# ==============================================================================

set -e

echo "=========================================================="
echo "    MAKORAN ONE / MAKORAN GUARD — EDGE AGENT INSTALLER    "
echo "=========================================================="

if [ "$EUID" -ne 0 ]; then
  echo "Please run this installer as root: sudo ./install.sh"
  exit 1
fi

INSTALL_DIR="/opt/makoran-agent"
SERVICE_NAME="makoran-agent"

echo "[1/5] Creating installation directory: $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/data"
mkdir -p "$INSTALL_DIR/updates"

echo "[2/5] Copying agent runtime files..."
cp -r src "$INSTALL_DIR/"
cp -r package.json "$INSTALL_DIR/"
cp -r tsconfig.json "$INSTALL_DIR/"

echo "[3/5] Setting up environment configuration..."
cat << 'EOF' > "$INSTALL_DIR/.env"
CLOUD_HOST=cloud.makoran.io
CLOUD_PORT=443
AGENT_ID=agent-n100-site01
TENANT_ID=tenant-makoran-01
AGENT_TOKEN=agt_tok_makoran_secret_01
HEARTBEAT_INTERVAL=10000
EOF

echo "[4/5] Creating Systemd Service: /etc/systemd/system/$SERVICE_NAME.service..."
cat << EOF > "/etc/systemd/system/$SERVICE_NAME.service"
[Unit]
Description=Makoran Guard Edge Agent Gateway Service
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/node $INSTALL_DIR/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
echo "[5/5] Enabling and starting Makoran Agent service..."
systemctl enable "$SERVICE_NAME" || true

echo "=========================================================="
echo "✅ MAKORAN AGENT SUCCESSFULLY INSTALLED ON MINI PC"
echo "Status check: sudo systemctl status $SERVICE_NAME"
echo "Logs monitor: sudo journalctl -u $SERVICE_NAME -f"
echo "=========================================================="
