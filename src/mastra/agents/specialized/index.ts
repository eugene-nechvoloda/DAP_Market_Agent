/**
 * Specialized Agents for Multi-Agent Market Research System
 *
 * This module contains focused, single-responsibility agents:
 * - ReportWriterAgent: Generates report sections (50-line prompts vs 330-line monolith)
 * - FactCheckerAgent: Verifies claims against sources
 * - CitationVerifierAgent: Ensures proper citations
 *
 * Benefits:
 * - Modular, maintainable prompts
 * - Structured I/O with Zod validation
 * - Clear separation of concerns
 * - Easier to test and debug
 */

export * from './ReportWriterAgent';
export * from './FactCheckerAgent';
