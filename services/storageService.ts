import type { Source } from '../types';

// Lớp lỗi tùy chỉnh để xác định khi không tìm thấy Gist.
export class GistNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GistNotFoundError';
  }
}

const GITHUB_API_BASE_URL = 'https://api.github.com/gists';
const FILENAME = 'sources.json';

// AdminConfig now only holds the credentials needed for writing.
export interface AdminConfig {
    githubToken: string;
    savedAt?: string; // ISO 8601 date string
}

export const DEFAULT_SOURCES: Source[] = [
  {
    id: 'default-1',
    title: 'Giới thiệu Tin Học Sao Việt',
    fileName: 'gioi-thieu.txt',
    content: {
      mimeType: 'text/plain',
      data: 'Trung Tâm Tin Học Sao Việt là một trong những đơn vị hàng đầu trong lĩnh vực đào tạo tin học văn phòng và ứng dụng công nghệ thông tin tại Việt Nam. Chúng tôi cung cấp các khóa học đa dạng từ cơ bản đến nâng cao, bao gồm Microsoft Word, Excel, PowerPoint, và các khóa học chuyên sâu về phân tích dữ liệu. Sứ mệnh của chúng tôi là trang bị cho học viên những kỹ năng cần thiết để thành công trong môi trường làm việc hiện đại.'
    }
  },
  {
    id: 'default-2',
    title: 'Cam kết chất lượng',
    fileName: 'cam-ket.txt',
    content: {
      mimeType: 'text/plain',
      data: 'Tại Tin Học Sao Việt, chất lượng giảng dạy là ưu tiên số một. Đội ngũ giảng viên của chúng tôi là những chuyên gia có nhiều năm kinh nghiệm thực tế và khả năng sư phạm xuất sắc. Chúng tôi cam kết 100% học viên sau khi hoàn thành khóa học sẽ nắm vững kiến thức và tự tin áp dụng vào công việc. Môi trường học tập hiện đại, thân thiện và luôn hỗ trợ học viên 24/7.'
    }
  }
];

/**
 * Fetches sources from a GitHub Gist, using ETag for conditional requests.
 * @param {string} gistId The ID of the Gist.
 * @param {string | null} etag The current ETag to check for modifications.
 * @returns {Promise<{ status: number, sources: Source[] | null, etag: string | null }>} A promise that resolves to the result.
 */
export async function getSources(gistId: string, etag: string | null = null): Promise<{ status: number, sources: Source[] | null, etag: string | null }> {
  if (!gistId) {
    console.warn("Gist ID is missing, returning default sources.");
    return { status: 200, sources: DEFAULT_SOURCES, etag: null };
  }

  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE_URL}/${gistId}`, {
      method: 'GET',
      headers: headers,
    });

    if (response.status === 304) {
      // Not modified, return the old ETag
      return { status: 304, sources: null, etag: etag };
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new GistNotFoundError(`Không tìm thấy Gist với ID '${gistId}'. Vui lòng kiểm tra lại Gist ID trong cấu hình của bạn.`);
      }
       if (response.status === 403) {
          throw new Error(`Đã đạt đến giới hạn truy cập API GitHub. Vui lòng thử lại sau.`);
      }
      throw new Error(`Lỗi API GitHub! status: ${response.status}`);
    }

    const newEtag = response.headers.get('ETag');
    const data = await response.json();

    if (!data.files || !data.files[FILENAME]) {
      console.warn(`File '${FILENAME}' not found in Gist, returning default sources.`);
      return { status: 200, sources: DEFAULT_SOURCES, etag: newEtag };
    }

    const fileContent = data.files[FILENAME].content;
    const sources = JSON.parse(fileContent);

    if (!Array.isArray(sources)) {
      console.error("Fetched Gist content is not an array, returning default sources.");
      return { status: 200, sources: DEFAULT_SOURCES, etag: newEtag };
    }

    return { status: 200, sources: sources.length > 0 ? sources : DEFAULT_SOURCES, etag: newEtag };

  } catch (error) {
    // Re-throw the original error to be handled by the caller
    if (error instanceof GistNotFoundError || (error instanceof Error && error.message.includes('API GitHub'))) {
        throw error;
    }
    console.error("Could not fetch sources from GitHub Gist:", error);
    throw new Error("Một lỗi mạng đã xảy ra khi lấy nguồn.");
  }
}


/**
 * Saves the list of sources to the specified GitHub Gist using a token.
 * @param {Source[]} sources The new array of sources to save.
 * @param {string} gistId The ID of the Gist to update.
 * @param {string} githubToken The admin's GitHub Personal Access Token with 'gist' scope.
 * @returns {Promise<{ etag: string | null }>} A promise that resolves with the new ETag on completion.
 */
export async function saveSources(sources: Source[], gistId: string, githubToken: string): Promise<{ etag: string | null }> {
    if (!gistId || !githubToken) {
        throw new Error("Cấu hình lưu trữ (Gist ID và GitHub Token) là bắt buộc để lưu các nguồn.");
    }
    
    const payload = {
        files: {
            [FILENAME]: {
                content: JSON.stringify(sources, null, 2), // Pretty-print for readability
            },
        },
    };

    try {
        const response = await fetch(`${GITHUB_API_BASE_URL}/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Lỗi API GitHub! status: ${response.status}, message: ${errorBody.message}`);
        }
        
        const newEtag = response.headers.get('ETag');
        return { etag: newEtag };

    } catch (error) {
        console.error("Could not save sources to GitHub Gist:", error);
         if (error instanceof Error && error.message.startsWith('Lỗi API GitHub!')) {
            throw error;
        }
        throw new Error('Không thể lưu các nguồn.');
    }
}


/**
 * Tests write access to a Gist using a provided token.
 * @param {string} gistId The ID of the Gist to test against.
 * @param {string} githubToken The GitHub Personal Access Token to test.
 * @returns {Promise<{success: boolean, message: string}>} Result of the connection test.
 */
export async function testStorageConnection(gistId: string, githubToken: string): Promise<{ success: boolean; message: string }> {
    if (!gistId || !githubToken) {
        return { success: false, message: "Cả Gist ID và GitHub Personal Access Token đều là bắt buộc." };
    }

    try {
        const response = await fetch(`${GITHUB_API_BASE_URL}/${gistId}`, {
            method: 'GET',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            cache: 'no-cache', // Đảm bảo yêu cầu kiểm tra luôn mới
        });
        
        if (!response.ok) {
            if (response.status === 404) throw new Error(`Không tìm thấy Gist với ID '${gistId}'.`);
            if (response.status === 401) throw new Error(`Token không hợp lệ hoặc đã hết hạn.`);
            throw new Error(`Lỗi API GitHub: ${response.statusText}`);
        }

        const scopes = response.headers.get('X-OAuth-Scopes');
        if (!scopes || !scopes.includes('gist')) {
             return { success: false, message: 'Kết nối thành công nhưng Token thiếu quyền "gist" cần thiết để lưu các thay đổi.' };
        }
        
        return { success: true, message: "Kết nối thành công! Gist hợp lệ và Token có quyền ghi." };
    } catch (error: any) {
        return { success: false, message: `Kết nối thất bại: ${error.message}` };
    }
}