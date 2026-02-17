import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class YandexDiskService {
  private readonly apiBaseUrl = 'https://cloud-api.yandex.net/v1/disk';

  /**
   * Download public folder/file from Yandex.Disk
   * Supports both public links and OAuth tokens
   */
  async getFilesFromPublicFolder(publicUrl: string): Promise<string[]> {
    try {
      // Get public resource metadata
      const metaUrl = `${this.apiBaseUrl}/public/resources?public_key=${encodeURIComponent(publicUrl)}&limit=100`;
      const metaResponse = await axios.get(metaUrl);

      const resource = metaResponse.data;

      // If it's a folder, get all image files
      if (resource.type === 'dir') {
        const imageFiles = resource._embedded.items.filter((item: any) => 
          this.isImageFile(item.name)
        );

        // Get download URLs for each image
        const downloadUrls = await Promise.all(
          imageFiles.map(async (file: any) => {
            const downloadUrl = await this.getPublicFileDownloadUrl(publicUrl, file.path);
            return downloadUrl;
          })
        );

        return downloadUrls;
      } else {
        // Single file
        if (!this.isImageFile(resource.name)) {
          throw new BadRequestException('File is not an image');
        }

        const downloadUrl = await this.getPublicFileDownloadUrl(publicUrl);
        return [downloadUrl];
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch files from Yandex.Disk: ${error.message}`
      );
    }
  }

  /**
   * Get direct download URL for public file
   */
  private async getPublicFileDownloadUrl(
    publicUrl: string,
    path?: string
  ): Promise<string> {
    try {
      let url = `${this.apiBaseUrl}/public/resources/download?public_key=${encodeURIComponent(publicUrl)}`;
      if (path) {
        url += `&path=${encodeURIComponent(path)}`;
      }

      const response = await axios.get(url);
      return response.data.href; // Direct download link
    } catch (error) {
      throw new BadRequestException(
        `Failed to get download URL: ${error.message}`
      );
    }
  }

  /**
   * Check if file is an image based on extension
   */
  private isImageFile(filename: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  }

  /**
   * Upload image from URL to backend storage and return CDN URL
   * This is needed because Avito requires stable image URLs
   */
  async uploadImageToCDN(imageUrl: string): Promise<string> {
    // TODO: Implement actual CDN upload (S3, Cloudflare, etc.)
    // For MVP: return original URL
    return imageUrl;
  }
}
