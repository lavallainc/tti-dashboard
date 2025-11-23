#!/usr/bin/env bash
set -euo pipefail

# === Edit these values before running ===
PROJECT=457728543473
BUCKET=lavallainc-tti-dashboard-site-private    # must be globally unique; change if needed
REGION=us-east1
TRIGGER_NAME=cb-deploy-site
REPO_OWNER=lavallainc
REPO_NAME=tti-dashboard
BRANCH_PATTERN="^main$"
DOMAIN=YOUR_DOMAIN_HERE   # <-- REPLACE with your domain (example: example.com)
# =======================================

# Helper output
echo "Project: $PROJECT"
echo "Bucket: $BUCKET"
echo "Region: $REGION"
echo "Domain: $DOMAIN"
echo ""

# 1) Set project
gcloud config set project "$PROJECT"

# 2) Enable required APIs
echo "Enabling APIs..."
gcloud services enable compute.googleapis.com cloudbuild.googleapis.com storage.googleapis.com iam.googleapis.com

# 3) Create private GCS bucket with uniform bucket-level access (private by default)
echo "Creating GCS bucket (private)..."
gsutil mb -l "$REGION" gs://"$BUCKET"

# Enforce uniform bucket-level access
gsutil uniformbucketlevelaccess set on gs://"$BUCKET"

# Remove any legacy ACLs (ensure private)
# (uniform access means object ACLs are ignored; bucket-level IAM will control access)
echo "Ensuring bucket is private (no allUsers binding)..."
# Remove public IAM binding if it exists
set +e
gsutil iam get gs://"$BUCKET" > /tmp/bucket_iam.json
# Remove any allUsers/objectViewer entries (non-fatal if absent)
jq 'if .bindings then .bindings |= map(select(.members | index("allUsers") | not)) else . end' /tmp/bucket_iam.json > /tmp/bucket_iam_clean.json || true
gcloud storage buckets set-iam-policy "gs://$BUCKET" /tmp/bucket_iam_clean.json || true
rm -f /tmp/bucket_iam.json /tmp/bucket_iam_clean.json
set -e

# 4) Grant Cloud Build service account permission to write objects to the bucket
echo "Granting Cloud Build service account objectAdmin on the bucket..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='get(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/storage.objectAdmin"

# 5) Grant Cloud CDN service agent permission to read objects from the bucket
CDN_SA="service-${PROJECT_NUMBER}@gcp-sa-cdn.iam.gserviceaccount.com"
echo "Granting Cloud CDN service agent ( $CDN_SA ) storage.objectViewer on the bucket..."
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${CDN_SA}" \
  --role="roles/storage.objectViewer"

# 6) Create Backend Bucket with Cloud CDN enabled
BACKEND_BUCKET_NAME="backend-bucket-tti"
echo "Creating Backend Bucket ($BACKEND_BUCKET_NAME) with Cloud CDN enabled..."
gcloud compute backend-buckets create "$BACKEND_BUCKET_NAME" \
  --gcs-bucket-name="$BUCKET" \
  --enable-cdn

# 7) Create URL map that routes to the backend bucket
URL_MAP_NAME="web-map-tti"
echo "Creating URL map ($URL_MAP_NAME)..."
gcloud compute url-maps create "$URL_MAP_NAME" --default-backend-bucket="$BACKEND_BUCKET_NAME"

# 8) Create a managed SSL certificate for your domain
SSL_CERT_NAME="managed-cert-tti"
echo "Creating managed SSL certificate ($SSL_CERT_NAME) for domain $DOMAIN..."
gcloud compute ssl-certificates create "$SSL_CERT_NAME" --domains="$DOMAIN"

# 9) Create target HTTPS proxy
HTTPS_PROXY="https-proxy-tti"
echo "Creating target HTTPS proxy ($HTTPS_PROXY)..."
gcloud compute target-https-proxies create "$HTTPS_PROXY" \
  --ssl-certificates="$SSL_CERT_NAME" \
  --url-map="$URL_MAP_NAME"

# 10) Reserve a global static IP for the load balancer
IP_NAME="lb-ipv4-tti"
echo "Reserving global static IP ($IP_NAME)..."
gcloud compute addresses create "$IP_NAME" --ip-version=IPV4 --global
LB_IP=$(gcloud compute addresses describe "$IP_NAME" --global --format="get(address)")
echo "Reserved IP: $LB_IP"

# 11) Create global forwarding rule for HTTPS (port 443)
FW_RULE_NAME="https-content-rule-tti"
echo "Creating global forwarding rule ($FW_RULE_NAME) to forward 443 -> $HTTPS_PROXY ..."
gcloud compute forwarding-rules create "$FW_RULE_NAME" \
  --address="$IP_NAME" \
  --global \
  --target-https-proxy="$HTTPS_PROXY" \
  --ports=443

# 12) Output DNS instructions and next steps
echo ""
echo "=== COMPLETE: Load balancer reserved IP ==="
echo "Add an A record for your domain that points to: $LB_IP"
echo "e.g. in your DNS provider: A @ $LB_IP"
echo ""
echo "Notes:"
echo "- The managed SSL certificate will be provisioned automatically by Google. It can take several minutes (or longer) to become ACTIVE. Check Console -> Network services -> Load balancing -> SSL certificates."
echo "- Once DNS points to the load balancer IP, certificate provisioning will proceed and HTTPS will be enabled for $DOMAIN."
echo "- Cloud Build trigger (cloudbuild.yaml present) will upload new artifacts to the private bucket; the Cloud CDN service has read access."
echo "- For further hardening, consider restricting which principals can list bucket contents and use signed URLs for private content."
echo ""
echo "To create the Cloud Build trigger (after you connect GitHub repo via Cloud Console):"
echo "gcloud beta builds triggers create github --name=\"$TRIGGER_NAME\" --repo-owner=\"$REPO_OWNER\" --repo-name=\"$REPO_NAME\" --branch-pattern=\"$BRANCH_PATTERN\" --build-config=cloudbuild.yaml --substitutions=_BUCKET=$BUCKET"
echo ""
echo "Done."
