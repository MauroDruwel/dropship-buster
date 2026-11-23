export interface ProductInfo {
  title: string;
  cleanQuery: string;
  price: number | null;
  currency: string;
  image: string;
  estSupplierMin: string | null;
  estSupplierMax: string | null;
  potentialSavings: number;
  lensUrl: string | null;
  aliExpressUrl: string;
  temuUrl: string;
  amazonUrl: string;
  chineseSupplierTitle?: string;
  supplierPrice?: string;
  supplierUrl?: string;
}

export interface DropshipSignal {
  category: 'Platform' | 'Fulfillment' | 'Theme' | 'Reviews' | 'Images' | 'Urgency' | 'Shipping' | 'Trust' | 'Marketplace' | 'Community' | 'SupplierArtifacts';
  name: string;
  weight: number;
  details: string;
}

export interface TrustSignal {
  name: string;
  weight: number;
  details: string;
}

export interface CommunityReport {
  id?: string;
  url: string;
  domain: string;
  platform?: string;
  title?: string;
  supplierUrl?: string;
  supplierPrice?: string;
  storePrice?: string;
  notes?: string;
  votes?: number;
  chinese_supplier_title?: string;
  timestamp?: string;
}

export interface ScanResult {
  isProductPage: boolean;
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
  signals: DropshipSignal[];
  trustSignals: TrustSignal[];
  product: ProductInfo | null;
  url: string;
  hostname: string;
  communityReport: CommunityReport | null;
}
