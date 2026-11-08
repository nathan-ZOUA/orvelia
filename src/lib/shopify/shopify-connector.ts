// ============================================================================
// ORVÉLIA — HYBRID SHOPIFY STOREFRONT & ADMIN API CONNECTOR
// Architect & Lead Engineering: Nathan Zoua (NZ)
// Permet de synchroniser le catalogue et les stocks avec une boutique Shopify
// tout en conservant le checkout souverain Flutterwave Mobile Money au Cameroun.
// ============================================================================

export interface ShopifyProductNode {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  variants: {
    edges: Array<{
      node: {
        id: string;
        sku: string;
        price: { amount: string; currencyCode: string };
        quantityAvailable: number;
      };
    }>;
  };
}

export class OrveliaShopifyConnector {
  private readonly domain: string;
  private readonly storefrontToken: string;
  private readonly adminToken: string;
  private readonly apiVersion: string;

  constructor() {
    this.domain = process.env.SHOPIFY_STORE_DOMAIN || '';
    this.storefrontToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || '';
    this.adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2026-01';
  }

  public isConfigured(): boolean {
    return Boolean(this.domain && this.storefrontToken && !this.storefrontToken.includes('VOTRE_'));
  }

  /**
   * Interroge la Storefront GraphQL API de Shopify pour synchroniser les produits
   */
  public async fetchCatalogFromStorefront(first = 20): Promise<ShopifyProductNode[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const query = `
      query OrveliaCatalogSync($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              handle
              title
              descriptionHtml
              variants(first: 10) {
                edges {
                  node {
                    id
                    sku
                    quantityAvailable
                    price {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${this.domain}/api/${this.apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': this.storefrontToken,
      },
      body: JSON.stringify({ query, variables: { first } }),
    });

    const json = await response.json();
    return json.data?.products?.edges?.map((e: { node: ShopifyProductNode }) => e.node) ?? [];
  }
}
