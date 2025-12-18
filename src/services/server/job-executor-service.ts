// src/services/server/job-executor-service.ts
'use server';

import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import type { Book, Piece, MultilingualContent, JobStatus } from '@/lib/types';
import { OriginService } from '../shared/origin-service';
import { SegmentParser } from '../shared/segment-parser';
import { ai } from '@/services/ai/genkit';
import { z } from 'zod';

const MAX_RETRIES = 3;

/**
 * Job Executor - Handles background content generation
 * 
 * This service is responsible for:
 * 1. Reading job from DB (locked origin)
 * 2. Generating content
 * 3. Parsing to segments
 * 4. Updating job status
 * 5. Retry logic (max 3 times)
 */
export class JobExecutor {
  
  /**
   * Execute content generation for a job
   */
  static async executeContentGeneration(
    userId: string,
    jobId: string
  ): Promise<void> {
    const adminDb = getAdminDb();
    const jobRef = adminDb.collection(`users/${userId}/libraryItems`).doc(jobId);

    try {
      // 1. Read job from DB (source of truth for origin)
      const jobDoc = await jobRef.get();
      if (!jobDoc.exists) {
        throw new Error('Job not found');
      }

      const job = jobDoc.data() as Book | Piece;
      const { origin, prompt, type } = job;

      // 2. Validate origin
      OriginService.validate(origin);

      // 3. Generate content based on type
      let result: {
        title: MultilingualContent;
        segments: any[];
      };

      if (type === 'book') {
        result = await this.generateBookContent(job as Book);
      } else {
        result = await this.generatePieceContent(job as Piece);
      }

      // 4. Parse to segments
      const segments = SegmentParser.parse(
        result.segments.join('\n'),
        origin
      );

      // 5. Update job as ready
      await jobRef.update({
        title: result.title,
        content: segments,
        contentState: 'ready',
        status: 'draft',
        updatedAt: FieldValue.serverTimestamp()
      });

    } catch (error) {
      await this.handleJobError(userId, jobId, error as Error);
    }
  }

  /**
   * Execute cover generation for a book
   */
  static async executeCoverGeneration(
    userId: string,
    bookId: string,
    coverData: { type: 'upload' | 'ai'; data: string | File }
  ): Promise<void> {
    const adminDb = getAdminDb();
    const bookRef = adminDb.collection(`users/${userId}/libraryItems`).doc(bookId);

    try {
      let coverUrl: string;

      if (coverData.type === 'ai') {
        // Generate with AI
        const prompt = coverData.data as string;
        const { media } = await ai.generate({
          model: 'googleai/imagen-4.0-fast-generate-001',
          prompt: `Book cover: ${prompt}`
        });

        if (!media?.url) {
          throw new Error('AI failed to generate cover');
        }
        coverUrl = media.url;
      } else {
        // Upload file (implementation depends on storage solution)
        coverUrl = await this.uploadCoverFile(userId, bookId, coverData.data as File);
      }

      await bookRef.update({
        cover: { type: coverData.type, url: coverUrl },
        coverState: 'ready',
        updatedAt: FieldValue.serverTimestamp()
      });

    } catch (error) {
      await this.handleCoverError(userId, bookId, error as Error);
    }
  }

  /**
   * Handle job error with retry logic
   */
  private static async handleJobError(
    userId: string,
    jobId: string,
    error: Error
  ): Promise<void> {
    const adminDb = getAdminDb();
    const jobRef = adminDb.collection(`users/${userId}/libraryItems`).doc(jobId);
    const jobDoc = await jobRef.get();
    const retries = (jobDoc.data()?.contentRetries || 0) + 1;

    if (retries < MAX_RETRIES) {
      // Retry
      console.log(`Job ${jobId} failed, retry ${retries}/${MAX_RETRIES}`);
      await jobRef.update({
        contentRetries: retries,
        updatedAt: FieldValue.serverTimestamp()
      });

      // Schedule retry (simple setTimeout for now)
      setTimeout(() => {
        this.executeContentGeneration(userId, jobId);
      }, 1000 * retries); // Exponential backoff
    } else {
      // Max retries reached
      await jobRef.update({
        contentState: 'error',
        contentError: error.message,
        status: 'draft',
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  }

  /**
   * Handle cover error with retry logic
   */
  private static async handleCoverError(
    userId: string,
    bookId: string,
    error: Error
  ): Promise<void> {
    const adminDb = getAdminDb();
    const bookRef = adminDb.collection(`users/${userId}/libraryItems`).doc(bookId);
    const bookDoc = await bookRef.get();
    const retries = (bookDoc.data()?.coverRetries || 0) + 1;

    if (retries < MAX_RETRIES) {
      console.log(`Cover ${bookId} failed, retry ${retries}/${MAX_RETRIES}`);
      await bookRef.update({
        coverRetries: retries,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      await bookRef.update({
        coverState: 'error',
        coverError: error.message,
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private static async generateBookContent(book: Book) {
    // Call AI to generate book content
    // Return parsed result
    throw new Error('Not implemented - use existing book generation logic');
  }

  private static async generatePieceContent(piece: Piece) {
    // Call AI to generate piece content
    // Return parsed result
    throw new Error('Not implemented - use existing piece generation logic');
  }

  private static async uploadCoverFile(
    userId: string,
    bookId: string,
    file: File
  ): Promise<string> {
    // Upload to Firebase Storage
    // Return URL
    throw new Error('Not implemented - use existing upload logic');
  }
}