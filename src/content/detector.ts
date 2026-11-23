/**
 * Dropship Buster - Detection Engine & Product Scraper (TypeScript)
 * Analyzes internal HTML, dropshipping footprints, Chinese supplier artifacts, and scrapes product metadata
 */

import { ProductInfo, DropshipSignal, TrustSignal, ScanResult, CommunityReport } from '../types';

declare global {
  interface Window {
    __dropshipBusterLoaded?: boolean;
    __dropshipScanResult?: ScanResult;
    __dropshipKnownReports?: CommunityReport[];
    DropshipDetectorInstance?: DropshipDetector;
    Shopify?: any;
  }
}

export class DropshipDetector {
  public signals: DropshipSignal[] = [];
  public trustSignals: TrustSignal[] = [];
  public riskScore: number = 0;
  public product: ProductInfo | null = null;
  public isProductPage: boolean = false;
  public communityReport: CommunityReport | null = null;

  scan(): ScanResult {
    this.signals = [];
    this.trustSignals = [];
    this.isProductPage = this.detectProductPage();
    this.product = this.extractProductInfo();

    this.checkCommunityDatabase();
    this.checkPlatformFootprint();
    this.checkMarketplaceDropshipper();
    this.checkFulfillmentApps();
    this.checkDropshipThemes();
    this.checkReviewImporters();
    this.checkImageOrigins();
    this.checkChineseSupplierArtifacts();
    this.checkUrgencyAndScarcity();
    this.checkShippingAndPolicies();
    this.checkTrustDampeners();
    this.calculateScore();

    return {
      isProductPage: this.isProductPage,
      riskScore: this.riskScore,
      riskLevel: this.getRiskLevel(),
      signals: this.signals,
      trustSignals: this.trustSignals,
      product: this.product,
      url: window.location.href,
      hostname: window.location.hostname,
      communityReport: this.communityReport
    };
  }

  detectProductPage(): boolean {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/products/') || path.includes('/product/') || path.includes('/item/') || path.includes('/p/') || path.includes('/dp/')) {
      return true;
    }

    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(jsonLdScripts)) {
      try {
        const json = JSON.parse(script.textContent || '{}');
        if (json['@type'] === 'Product' || (Array.isArray(json['@graph']) && json['@graph'].some((i: any) => i['@type'] === 'Product'))) {
          return true;
        }
      } catch (e) {}
    }

    const cartButtons = document.querySelectorAll('button[name="add"], button.add-to-cart, button[id*="AddToCart"], .btn--add-to-cart, form[action*="/cart/add"]');
    if (cartButtons.length > 0) return true;

    const ogType = document.querySelector('meta[property="og:type"]') as HTMLMetaElement | null;
    if (ogType && ogType.content.toLowerCase().includes('product')) return true;

    return false;
  }

  extractProductInfo(): ProductInfo {
    let title = '';
    let price: number | null = null;
    let currency = '$';
    let image = '';

    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    const h1 = document.querySelector('h1.product-title, h1[itemprop="name"], .product__title h1, h1, [data-test="title"]');
    if (ogTitle && ogTitle.content) {
      title = ogTitle.content.trim();
    } else if (h1) {
      title = (h1.textContent || '').trim();
    }

    if (title.includes('–')) title = title.split('–')[0].trim();
    if (title.includes('-')) {
      const parts = title.split('-');
      if (parts.length === 2 && parts[1].length < 25) title = parts[0].trim();
    }
    if (title.includes('|')) title = title.split('|')[0].trim();

    const ogPrice = document.querySelector('meta[property="og:price:amount"], meta[property="product:price:amount"]') as HTMLMetaElement | null;
    const ogCurrency = document.querySelector('meta[property="og:price:currency"], meta[property="product:price:currency"]') as HTMLMetaElement | null;
    if (ogCurrency && ogCurrency.content) currency = ogCurrency.content;

    if (ogPrice && ogPrice.content) {
      price = parseFloat(ogPrice.content.replace(/[^0-9.]/g, ''));
    } else {
      const priceEl = document.querySelector('.price__regular, .product-price, .price-item--regular, [itemprop="price"], .product__price, .price, .promo-price, [data-test="price"], .price-block__highlight, span.a-price-whole');
      if (priceEl && priceEl.textContent) {
        const match = priceEl.textContent.match(/[\$\€\£]?\s*([0-9]+[.,]?[0-9]*)/);
        if (match) {
          price = parseFloat(match[1].replace(',', '.'));
        }
      }
    }

    const ogImage = document.querySelector('meta[property="og:image"], meta[name="twitter:image"]') as HTMLMetaElement | null;
    if (ogImage && ogImage.content) {
      image = ogImage.content;
    } else {
      const productImg = document.querySelector('.product__media img, .product-single__photo img, img[itemprop="image"], .product-featured-media, [data-test="product-image"] img, #landingImage') as HTMLImageElement | null;
      if (productImg) image = productImg.src || productImg.dataset.src || '';
    }

    if (image && image.startsWith('//')) {
      image = 'https:' + image;
    }

    const cleanQuery = this.cleanTitleForSearch(title);

    let estSupplierMin: string | null = null;
    let estSupplierMax: string | null = null;
    let potentialSavings = 70;
    if (price && price > 0) {
      estSupplierMin = (price * 0.15).toFixed(2);
      estSupplierMax = (price * 0.28).toFixed(2);
      potentialSavings = Math.round(((price - parseFloat(estSupplierMax)) / price) * 100);
    }

    return {
      title,
      cleanQuery,
      price,
      currency,
      image,
      estSupplierMin,
      estSupplierMax,
      potentialSavings: potentialSavings > 0 ? potentialSavings : 70,
      lensUrl: image ? `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(image)}` : null,
      aliExpressUrl: `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(cleanQuery)}`,
      temuUrl: `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(cleanQuery)}`,
      amazonUrl: `https://www.amazon.com/s?k=${encodeURIComponent(cleanQuery)}`
    };
  }

  cleanTitleForSearch(raw: string): string {
    if (!raw) return '';
    let text = raw;

    if (text.includes(',')) {
      const parts = text.split(',').map(p => p.trim()).filter(p => p.length > 0);
      if (parts.length > 0) {
        text = parts[0] + (parts[1] ? ' ' + parts[1] : '');
      }
    }

    text = text.replace(/-\s*(stijl|style|type|model|kleur|color|versie|version)\s*[a-z0-9]+/gi, ' ');

    return text
      .replace(/[^\w\s-]/gi, ' ')
      .replace(/\b(hot|new|2024|2025|2026|portable|sale|deal|off|free|shipping|upgrade|trending|viral|pro|upgraded|high|quality|discount|exclusive|uniek|cadeau|verzamelcadeau|feestelijke|decoratie|voor|met|via|stijl|style)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);
  }

  checkCommunityDatabase(): void {
    const knownReports: CommunityReport[] = window.__dropshipKnownReports || [
      {
        url: 'https://novahomeamsterdam.nl',
        domain: 'novahomeamsterdam.nl',
        notes: 'PagePilot AI dropship store with 800% markups shipping from China.',
        votes: 28
      },
      {
        url: 'https://www.bol.com/nl/nl/p/magnetische-muziekspeler-magnetische-kerst-muziekdoos',
        domain: 'bol.com',
        notes: '3rd party reseller dropshipping $7 AliExpress magnetic NFC vinyl player for €39.95.',
        chinese_supplier_title: '冰箱贴黑胶唱机',
        votes: 14
      }
    ];

    const currentUrl = window.location.href.toLowerCase();
    const currentDomain = window.location.hostname.toLowerCase();

    const match = knownReports.find(r => 
      (r.url && currentUrl.includes(r.url.toLowerCase())) || 
      (r.domain && currentDomain === r.domain.toLowerCase() && r.domain !== 'bol.com' && r.domain !== 'amazon.com')
    );

    if (match) {
      this.signals.push({
        category: 'Community',
        name: 'Community Confirmed Dropshipper',
        weight: 75,
        details: match.notes || `Reported by multiple verified shoppers (${match.votes || 1} confirmations).`
      });
      this.communityReport = match;

      if (match.chinese_supplier_title && this.product && !this.product.chineseSupplierTitle) {
        this.product.chineseSupplierTitle = match.chinese_supplier_title;
      }
    }
  }

  checkMarketplaceDropshipper(): void {
    const host = window.location.hostname.toLowerCase();
    const html = document.documentElement.innerHTML.toLowerCase();
    const text = document.body ? document.body.innerText.toLowerCase() : '';
    const title = this.product && this.product.title ? this.product.title : '';

    if (host.includes('bol.com')) {
      const isBol3rdParty = 
        (html.includes('verkoop door') || text.includes('verkoop door')) && 
        !html.includes('verkoop door bol.com') && 
        !html.includes('verkoop door bol\n');

      const slowPartnerDelivery = 
        /3\s*-\s*6\s*werkdagen/i.test(text) ||
        /4\s*-\s*8\s*werkdagen/i.test(text) ||
        /5\s*-\s*8\s*werkdagen/i.test(text) ||
        /5\s*-\s*10\s*werkdagen/i.test(text) ||
        /7\s*-\s*12\s*werkdagen/i.test(text) ||
        /verzending\s+door\s+partner/i.test(text);

      const isAliExpressTitle = title.length > 80 && (title.includes(',') || title.split(' ').length >= 12);
      const hasAliVariantSuffix = /-\s*(stijl|style|type|model)\s*[a-z0-9]+/i.test(title);

      if (isBol3rdParty) {
        this.signals.push({
          category: 'Marketplace',
          name: 'Bol.com Third-Party Partner Seller',
          weight: 25,
          details: 'Sold by an external partner seller rather than Bol.com directly.'
        });
      }

      if (slowPartnerDelivery) {
        this.signals.push({
          category: 'Marketplace',
          name: 'Extended Partner Delivery (5-10 Days)',
          weight: 35,
          details: 'Delivery window is 5-10 days, indicating direct dropshipping from overseas or remote supplier.'
        });
      }

      if (isAliExpressTitle || hasAliVariantSuffix) {
        this.signals.push({
          category: 'Marketplace',
          name: 'AliExpress Direct Title Syntax & SKU Suffix',
          weight: 35,
          details: 'Title exhibits classic AliExpress machine translation (keyword stuffing, commas, and variant tags like "- Stijl A").'
        });
      }
    }

    if (host.includes('amazon.')) {
      const isThirdPartyAmazon = 
        (html.includes('ships from') || html.includes('verzonden vanuit') || text.includes('ships from')) &&
        !html.includes('ships from amazon') && !html.includes('verzonden door amazon');

      const slowAmazonShipping = 
        /arrives\s+in\s+1\s*-\s*3\s*weeks/i.test(text) ||
        /delivery\s+in\s+10\s*-\s*20\s*days/i.test(text) ||
        /levering\s+binnen\s+1\s*-\s*3\s*weken/i.test(text);

      const isAliExpressTitle = title.length > 90 && (title.includes(',') || title.split(' ').length >= 14);

      if (isThirdPartyAmazon) {
        this.signals.push({
          category: 'Marketplace',
          name: 'Amazon Third-Party Merchant Fulfillment',
          weight: 25,
          details: 'Dispatched and sold directly by an independent seller rather than Amazon warehouses.'
        });
      }

      if (slowAmazonShipping) {
        this.signals.push({
          category: 'Marketplace',
          name: 'Extended Merchant Transit Time',
          weight: 35,
          details: 'Long delivery timeframe indicates overseas dropshipping to the customer.'
        });
      }

      if (isAliExpressTitle) {
        this.signals.push({
          category: 'Marketplace',
          name: 'Wholesale Title Formatting',
          weight: 30,
          details: 'Excessive title length and comma structure typical of supplier cross-listing.'
        });
      }
    }
  }

  checkPlatformFootprint(): void {
    const html = document.documentElement.innerHTML.toLowerCase();
    
    const isShopify = 
      typeof window.Shopify !== 'undefined' ||
      html.includes('cdn.shopify.com') ||
      html.includes('myshopify.com') ||
      html.includes('shopify-buy') ||
      document.querySelector('link[href*="cdn.shopify.com"]') !== null;

    if (isShopify) {
      this.signals.push({
        category: 'Platform',
        name: 'Shopify Store Infrastructure',
        weight: 20,
        details: 'Built on Shopify (the primary platform used by 95% of dropshippers).'
      });
    }

    const isWooCommerce = html.includes('wp-content/plugins/woocommerce');
    if (isWooCommerce) {
      this.signals.push({
        category: 'Platform',
        name: 'WooCommerce Store',
        weight: 15,
        details: 'Built on WooCommerce platform.'
      });
    }
  }

  checkFulfillmentApps(): void {
    const html = document.documentElement.innerHTML.toLowerCase();
    
    const apps = [
      { name: 'DSers AliExpress Fulfillment', key: 'dsers', weight: 40, details: 'Direct AliExpress fulfillment app detected in page source.' },
      { name: 'PagePilot AI Dropship Generator', key: 'pagepilot', weight: 45, details: 'PagePilot.ai detected: AI dropship tool that clones AliExpress products in 1 click.' },
      { name: 'WeTracked Ad Pixel', key: 'wetracked', weight: 30, details: 'WeTracked.io pixel detected: specialized tracking used by TikTok/FB dropship campaigns.' },
      { name: 'CJ Dropshipping', key: 'cjdropshipping', weight: 40, details: 'CJ Dropshipping automated supplier connector detected.' },
      { name: 'Oberlo', key: 'oberlo', weight: 40, details: 'Oberlo dropship fulfillment integration detected.' },
      { name: 'AutoDS', key: 'autods', weight: 40, details: 'AutoDS multi-channel dropshipping automation detected.' },
      { name: 'Zendrop', key: 'zendrop', weight: 40, details: 'Zendrop fast-shipping dropship agent script detected.' },
      { name: 'Spocket', key: 'spocket', weight: 35, details: 'Spocket supplier fulfillment tool detected.' },
      { name: 'AliOrders', key: 'aliorders', weight: 40, details: 'AliOrders 1-click dropship order placement detected.' }
    ];

    for (const app of apps) {
      if (html.includes(app.key)) {
        this.signals.push({
          category: 'Fulfillment',
          name: app.name,
          weight: app.weight,
          details: app.details
        });
      }
    }
  }

  checkDropshipThemes(): void {
    const html = document.documentElement.innerHTML.toLowerCase();
    const themes = [
      { name: 'Debutify Dropship Theme', key: 'debutify', weight: 30, details: 'Debutify detected: the #1 purpose-built dropshipping theme.' },
      { name: 'Booster Theme', key: 'booster-theme', weight: 25, details: 'Booster Theme detected: high-urgency dropshipping theme.' },
      { name: 'Shoptimized Theme', key: 'shoptimized', weight: 25, details: 'Shoptimized dropshipping conversion theme detected.' },
      { name: 'Plak Theme', key: 'plak-theme', weight: 25, details: 'Plak dropshipping theme detected.' }
    ];

    for (const t of themes) {
      if (html.includes(t.key)) {
        this.signals.push({
          category: 'Theme',
          name: t.name,
          weight: t.weight,
          details: t.details
        });
      }
    }
  }

  checkReviewImporters(): void {
    const html = document.documentElement.innerHTML.toLowerCase();

    const reviewApps = [
      { name: 'Loox AliExpress Review Importer', key: 'loox', weight: 30, details: 'Loox detected. Often used to bulk-import AliExpress buyer photos and reviews.' },
      { name: 'AliReviews', key: 'alireviews', weight: 35, details: 'AliReviews detected: software designed specifically to mirror AliExpress reviews.' },
      { name: 'Ryviu', key: 'ryviu', weight: 30, details: 'Ryviu product reviews importer detected.' },
      { name: 'Areviews', key: 'areviews', weight: 30, details: 'Areviews AliExpress/Amazon reviews importer detected.' },
      { name: 'Rivyo', key: 'rivyo', weight: 30, details: 'Rivyo product reviews importer detected.' },
      { name: 'Vitals All-in-One', key: 'vitals-app', weight: 25, details: 'Vitals dropshipping conversion toolkit detected.' },
      { name: 'Judge.me', key: 'judgeme', weight: 15, details: 'Judge.me review widget installed.' }
    ];

    for (const rev of reviewApps) {
      if (html.includes(rev.key)) {
        this.signals.push({
          category: 'Reviews',
          name: rev.name,
          weight: rev.weight,
          details: rev.details
        });
      }
    }
  }

  checkImageOrigins(): void {
    const html = document.documentElement.innerHTML.toLowerCase();
    const aliImages = html.includes('alicdn.com') || html.includes('ae01.alicdn.com') || html.includes('cbu01.alicdn.com');
    
    if (aliImages) {
      this.signals.push({
        category: 'Images',
        name: 'Direct AliExpress CDN Asset Hosting',
        weight: 45,
        details: 'Images or assets are hosted directly on alicdn.com (AliExpress/Alibaba CDN servers).'
      });
    }
  }

  checkChineseSupplierArtifacts(): void {
    const rawHtml = document.documentElement.innerHTML;

    const has1688ImageHash = /O1CN01[a-zA-Z0-9]{8,}/.test(rawHtml);
    if (has1688ImageHash) {
      this.signals.push({
        category: 'SupplierArtifacts',
        name: '1688.com Wholesale Image Signature (O1CN01)',
        weight: 45,
        details: 'Image filenames retain the signature O1CN01 hash generated by 1688/Alibaba factories.'
      });
    }

    const chineseRegex = /[\u4e00-\u9fa5]{2,}/g;
    let detectedChinesePhrases: string[] = [];

    const elementsToCheck = document.querySelectorAll('img[alt], [data-variant], [data-title], option, .product-single, [data-test="title"]');
    elementsToCheck.forEach(el => {
      const str = (el.getAttribute('alt') || '') + ' ' + (el.getAttribute('title') || '') + ' ' + ((el as HTMLElement).innerText || '');
      const matches = str.match(chineseRegex);
      if (matches) {
        detectedChinesePhrases.push(...matches);
      }
    });

    const scriptMatches = rawHtml.match(/[\u4e00-\u9fa5]{2,}/g);
    if (scriptMatches && scriptMatches.length > 0) {
      detectedChinesePhrases.push(...scriptMatches.slice(0, 5));
    }

    detectedChinesePhrases = [...new Set(detectedChinesePhrases)];

    if (detectedChinesePhrases.length > 0) {
      const preview = detectedChinesePhrases.slice(0, 3).join(', ');
      this.signals.push({
        category: 'SupplierArtifacts',
        name: 'Untranslated Chinese Supplier Metadata',
        weight: 50,
        details: `Direct factory import: found Chinese supplier strings in internal code: "${preview}".`
      });

      if (this.product && !this.product.chineseSupplierTitle) {
        this.product.chineseSupplierTitle = detectedChinesePhrases.join(' ');
      }
    }
  }

  checkUrgencyAndScarcity(): void {
    const html = document.documentElement.innerHTML.toLowerCase();

    const hasCountdown = 
      html.includes('countdown') ||
      html.includes('hurrify') ||
      document.querySelector('[id*="countdown"], [class*="countdown"], [class*="timer"], [id*="timer"]') !== null;

    if (hasCountdown && this.isProductPage) {
      this.signals.push({
        category: 'Urgency',
        name: 'Artificial Countdown Timer',
        weight: 20,
        details: 'High-pressure countdown clock detected to induce FOMO panic buying.'
      });
    }

    const hasSocialProof = 
      html.includes('fomo') ||
      html.includes('sales-pop') ||
      html.includes('nudgify') ||
      html.includes('beeketing') ||
      document.querySelector('[class*="sales-pop"], [id*="recent-sales"], [class*="recent-orders"]') !== null;

    if (hasSocialProof) {
      this.signals.push({
        category: 'Urgency',
        name: 'Fake Social Proof Popups',
        weight: 20,
        details: 'Synthetic notifications claiming other shoppers recently bought this item.'
      });
    }

    const text = document.body ? document.body.innerText.toLowerCase() : '';
    if (/only\s+[0-9]+\s+left\s+in\s+stock/i.test(text) || /selling\s+fast/i.test(text) || /low\s+stock/i.test(text)) {
      this.signals.push({
        category: 'Urgency',
        name: 'Stock Scarcity Warning',
        weight: 15,
        details: '"Only a few left in stock" messaging detected.'
      });
    }

    if (html.includes('wheelio') || html.includes('spin-a-sale')) {
      this.signals.push({
        category: 'Urgency',
        name: 'Spin-To-Win Discount Wheel',
        weight: 20,
        details: 'Gamified discount spinner commonly bundled in dropshipping stores.'
      });
    }
  }

  checkShippingAndPolicies(): void {
    const text = document.body ? document.body.innerText.toLowerCase() : '';

    const longShipping = 
      /12\s*-\s*25\s*(business\s*)?days/i.test(text) ||
      /15\s*-\s*30\s*(business\s*)?days/i.test(text) ||
      /2\s*-\s*4\s*weeks/i.test(text) ||
      /7\s*-\s*16\s*werkdagen/i.test(text) ||
      /10\s*-\s*20\s*werkdagen/i.test(text) ||
      /delivered at place/i.test(text) ||
      /\bdap\s+voorwaarden\b/i.test(text) ||
      /due to high (demand|volume),? please allow/i.test(text);

    if (longShipping) {
      this.signals.push({
        category: 'Shipping',
        name: 'Extended Overseas Delivery Timeline',
        weight: 25,
        details: 'Shipping estimates of 10-30 days or DAP delivery terms indicate direct factory dispatch from Asia.'
      });
    }

    if (/@gmail\.com\b/i.test(text) || /@outlook\.com\b/i.test(text) || /@yahoo\.com\b/i.test(text)) {
      this.signals.push({
        category: 'Trust',
        name: 'Free Webmail Contact Address',
        weight: 15,
        details: 'Customer support uses a free email provider (e.g. Gmail) instead of a branded company domain.'
      });
    }
  }

  checkTrustDampeners(): void {
    const html = document.documentElement.innerHTML.toLowerCase();
    const text = document.body ? document.body.innerText.toLowerCase() : '';

    if (html.includes('demandware.net') || html.includes('salesforce commerce') || html.includes('mage/cookies') || html.includes('hybris') || html.includes('bigcommerce.com/assets')) {
      this.trustSignals.push({
        name: 'Enterprise Commerce Architecture',
        weight: 40,
        details: 'Built on dedicated enterprise commerce infrastructure (Salesforce/Magento/SAP).'
      });
    }

    const fastShipping = 
      /voor\s+23:?59\s+(besteld|uur)/i.test(text) ||
      /morgen\s+in\s+huis/i.test(text) ||
      /vandaag\s+besteld/i.test(text) ||
      /next\s+day\s+delivery/i.test(text) ||
      /delivered\s+in\s+1-2\s+business\s+days/i.test(text) ||
      /same-day\s+delivery/i.test(text);

    if (fastShipping) {
      this.trustSignals.push({
        name: 'Fast Domestic 24h/48h Delivery',
        weight: 30,
        details: 'Guarantees domestic 24-48h fulfillment (impossible for overseas dropshipping).'
      });
    }

    if (html.includes('thuiswinkel waarborg') || html.includes('trusted shops') || html.includes('webwinkelkeur') || html.includes('b corp certified')) {
      this.trustSignals.push({
        name: 'Verified Trust Certification',
        weight: 25,
        details: 'Holds accredited consumer protection certification.'
      });
    }

    if (/vind\s+een\s+winkel/i.test(text) || /store\s+locator/i.test(text) || /in\s+de\s+winkel\s+ophalen/i.test(text) || /click\s+&\s+collect/i.test(text)) {
      this.trustSignals.push({
        name: 'Physical Retail / Click & Collect Network',
        weight: 30,
        details: 'Operates brick-and-mortar stores or domestic pickup points.'
      });
    }

    if (/\bkvk:?\s*[0-9]{8}\b/i.test(text) || /\bbtw(-identificatie)?nummer:?\s*nl[0-9]{9}b[0-9]{2}\b/i.test(text) || /\bvat\s+id:?\s*[a-z0-9]+/i.test(text)) {
      this.trustSignals.push({
        name: 'Official Corporate Registry (KvK/VAT)',
        weight: 15,
        details: 'Displays official verified chamber of commerce or VAT tax identification.'
      });
    }
  }

  calculateScore(): void {
    const dropshipPoints = this.signals.reduce((sum, s) => sum + s.weight, 0);
    let trustDampening = this.trustSignals.reduce((sum, s) => sum + s.weight, 0);

    const hasMarketplaceSignals = this.signals.some(s => s.category === 'Marketplace');
    const hasCommunityReport = this.signals.some(s => s.category === 'Community');
    if (hasMarketplaceSignals || hasCommunityReport) {
      trustDampening = 0;
    }

    let netScore = Math.max(0, dropshipPoints - trustDampening);

    if (!this.isProductPage && netScore > 0) {
      netScore = Math.min(netScore, 40);
    }

    const hasDirectDropshipApp = this.signals.some(s => s.category === 'Fulfillment' || s.name.includes('PagePilot') || s.name.includes('DSers'));
    if ((hasDirectDropshipApp || hasCommunityReport) && this.isProductPage) {
      netScore = Math.max(netScore, 75);
    } else if (hasMarketplaceSignals && this.signals.filter(s => s.category === 'Marketplace').length >= 2) {
      netScore = Math.max(netScore, 70);
    }

    this.riskScore = Math.min(Math.round(netScore), 98);
  }

  getRiskLevel(): 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH' {
    if (this.riskScore >= 70) return 'VERY HIGH';
    if (this.riskScore >= 50) return 'HIGH';
    if (this.riskScore >= 30) return 'MODERATE';
    return 'LOW';
  }
}

// Instantiate and attach globally
(function () {
  if (window.__dropshipBusterLoaded) return;
  window.__dropshipBusterLoaded = true;

  window.DropshipDetectorInstance = new DropshipDetector();
  const result = window.DropshipDetectorInstance.scan();

  chrome.runtime.sendMessage({
    type: 'DROPSHIP_SCAN_RESULT',
    data: result
  }).catch(() => {});

  window.__dropshipScanResult = result;
})();
