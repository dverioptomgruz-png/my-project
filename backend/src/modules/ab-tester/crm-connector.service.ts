import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface CRMProduct {
  crmProductId: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  costPrice?: number;
  stock?: number;
  category?: string;
  brand?: string;
  imageUrls: string[];
  attributes: Record<string, any>;
}

@Injectable()
export class CRMConnectorService {
  constructor(private configService: ConfigService) {}

  /**
   * Fetch products from CRM by search query
   * User says: "protestiruj kastryuli, skovorodki, kovshiki"
   * We search CRM for matching products
   */
  async searchProducts(
    crmSource: string,
    connectionId: string,
    searchQuery: string,
  ): Promise<CRMProduct[]> {
    switch (crmSource) {
      case 'moysklad':
        return this.searchMoySklad(connectionId, searchQuery);
      case 'bitrix':
        return this.searchBitrix(connectionId, searchQuery);
      case 'amocrm':
        return this.searchAmoCRM(connectionId, searchQuery);
      default:
        throw new BadRequestException(`Unknown CRM: ${crmSource}`);
    }
  }

  /**
   * Fetch ALL products from a CRM category/folder
   */
  async getProductsByCategory(
    crmSource: string,
    connectionId: string,
    categoryId: string,
  ): Promise<CRMProduct[]> {
    switch (crmSource) {
      case 'moysklad':
        return this.getMoySkladByFolder(connectionId, categoryId);
      case 'bitrix':
        return this.getBitrixBySection(connectionId, categoryId);
      default:
        throw new BadRequestException(`Unsupported for ${crmSource}`);
    }
  }

  // ========= MOY SKLAD (sklad.ru) =========

  private async searchMoySklad(
    token: string,
    query: string,
  ): Promise<CRMProduct[]> {
    try {
      const response = await axios.get(
        `https://api.moysklad.ru/api/remap/1.2/entity/product`,
        {
          params: { search: query, limit: 100 },
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.rows.map((item: any) => ({
        crmProductId: item.id,
        sku: item.article || item.code || '',
        name: item.name,
        description: item.description || '',
        price: (item.salePrices?.[0]?.value || 0) / 100, // kopeks -> rubles
        costPrice: item.buyPrice ? item.buyPrice.value / 100 : undefined,
        stock: item.stock || 0,
        category: item.productFolder?.name || '',
        brand: item.attributes?.find((a: any) => a.name === 'Brand')?.value || '',
        imageUrls: item.images?.rows?.map((img: any) => img.miniature?.href) || [],
        attributes: {
          weight: item.weight,
          volume: item.volume,
          barcode: item.barcodes?.[0]?.ean13 || '',
          country: item.country?.name || '',
          ...(item.attributes || []).reduce((acc: any, attr: any) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {}),
        },
      }));
    } catch (error) {
      throw new BadRequestException(
        `MoySklad API error: ${error.message}`,
      );
    }
  }

  private async getMoySkladByFolder(
    token: string,
    folderId: string,
  ): Promise<CRMProduct[]> {
    try {
      const response = await axios.get(
        `https://api.moysklad.ru/api/remap/1.2/entity/product`,
        {
          params: {
            filter: `productFolder=https://api.moysklad.ru/api/remap/1.2/entity/productfolder/${folderId}`,
            limit: 100,
          },
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.rows.map((item: any) => ({
        crmProductId: item.id,
        sku: item.article || item.code || '',
        name: item.name,
        description: item.description || '',
        price: (item.salePrices?.[0]?.value || 0) / 100,
        costPrice: item.buyPrice ? item.buyPrice.value / 100 : undefined,
        stock: item.stock || 0,
        category: item.productFolder?.name || '',
        brand: '',
        imageUrls: item.images?.rows?.map((img: any) => img.miniature?.href) || [],
        attributes: {},
      }));
    } catch (error) {
      throw new BadRequestException(
        `MoySklad folder error: ${error.message}`,
      );
    }
  }

  // ========= BITRIX24 =========

  private async searchBitrix(
    webhookUrl: string, // https://company.bitrix24.ru/rest/1/xxx/
    query: string,
  ): Promise<CRMProduct[]> {
    try {
      const response = await axios.post(
        `${webhookUrl}crm.product.list`,
        {
          filter: { '%NAME': query },
          select: [
            'ID', 'NAME', 'DESCRIPTION', 'PRICE', 'CURRENCY_ID',
            'CATALOG_ID', 'SECTION_ID', 'PREVIEW_PICTURE', 'DETAIL_PICTURE',
          ],
        },
      );

      return (response.data.result || []).map((item: any) => ({
        crmProductId: item.ID,
        sku: item.ID,
        name: item.NAME,
        description: item.DESCRIPTION || '',
        price: parseFloat(item.PRICE) || 0,
        costPrice: undefined,
        stock: undefined,
        category: item.SECTION_ID || '',
        brand: '',
        imageUrls: [item.PREVIEW_PICTURE, item.DETAIL_PICTURE].filter(Boolean),
        attributes: {},
      }));
    } catch (error) {
      throw new BadRequestException(
        `Bitrix24 API error: ${error.message}`,
      );
    }
  }

  private async getBitrixBySection(
    webhookUrl: string,
    sectionId: string,
  ): Promise<CRMProduct[]> {
    try {
      const response = await axios.post(
        `${webhookUrl}crm.product.list`,
        {
          filter: { SECTION_ID: sectionId },
          select: [
            'ID', 'NAME', 'DESCRIPTION', 'PRICE', 'CURRENCY_ID',
            'CATALOG_ID', 'SECTION_ID', 'PREVIEW_PICTURE', 'DETAIL_PICTURE',
          ],
        },
      );

      return (response.data.result || []).map((item: any) => ({
        crmProductId: item.ID,
        sku: item.ID,
        name: item.NAME,
        description: item.DESCRIPTION || '',
        price: parseFloat(item.PRICE) || 0,
        costPrice: undefined,
        stock: undefined,
        category: sectionId,
        brand: '',
        imageUrls: [item.PREVIEW_PICTURE, item.DETAIL_PICTURE].filter(Boolean),
        attributes: {},
      }));
    } catch (error) {
      throw new BadRequestException(
        `Bitrix24 section error: ${error.message}`,
      );
    }
  }

  // ========= AMOCRM =========

  private async searchAmoCRM(
    token: string, // format: "subdomain:access_token"
    query: string,
  ): Promise<CRMProduct[]> {
    try {
      const [subdomain, accessToken] = token.split(':');

      const response = await axios.get(
        `https://${subdomain}.amocrm.ru/api/v4/catalogs`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      // Find product catalog
      const productCatalog = response.data._embedded.catalogs.find(
        (c: any) => c.type === 'products' || c.name === 'Products',
      );

      if (!productCatalog) return [];

      const itemsResponse = await axios.get(
        `https://${subdomain}.amocrm.ru/api/v4/catalogs/${productCatalog.id}/elements`,
        {
          params: { query },
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      return (itemsResponse.data._embedded?.elements || []).map((item: any) => ({
        crmProductId: String(item.id),
        sku: String(item.id),
        name: item.name,
        description: '',
        price: item.custom_fields_values?.find(
          (f: any) => f.field_name === 'Price',
        )?.values?.[0]?.value || 0,
        costPrice: undefined,
        stock: undefined,
        category: '',
        brand: '',
        imageUrls: [],
        attributes: {},
      }));
    } catch (error) {
      throw new BadRequestException(
        `AmoCRM API error: ${error.message}`,
      );
    }
  }
}
