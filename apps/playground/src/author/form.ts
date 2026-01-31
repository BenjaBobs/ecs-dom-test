/**
 * Author form definition - pure form logic, no UI.
 */

import { createFormFactory } from '@ecs-test/forms';

/** Book data structure */
export type Book = {
  title: string;
  reviewScore: number;
};

/** Author form data structure */
export type Author = {
  name: string;
  age: number;
  averageReviewScore: number;
  books: Book[];
};

/**
 * Author form factory.
 * Creates isolated form instances with validation and computed fields.
 */
export const AuthorForm = createFormFactory<Author>({
  initialValues: {
    name: '',
    age: 0,
    averageReviewScore: 0,
    books: [],
  },

  validate: {
    name: v => (!v || v.trim().length === 0 ? 'Name is required' : undefined),
    age: v => (v < 0 ? 'Age must be positive' : undefined),
    books: {
      _self: books => (books.length === 0 ? 'At least one book is required' : undefined),
      title: v => (!v || v.trim().length === 0 ? 'Title is required' : undefined),
      reviewScore: v => (v < 1 || v > 5 ? 'Score must be between 1 and 5' : undefined),
    },
  },

  computed: {
    averageReviewScore: data => {
      if (data.books.length === 0) return 0;
      const total = data.books.reduce((sum, book) => sum + book.reviewScore, 0);
      return Math.round((total / data.books.length) * 10) / 10;
    },
  },
});

/** Type-safe field accessors for UI binding */
export const f = AuthorForm.fields;
