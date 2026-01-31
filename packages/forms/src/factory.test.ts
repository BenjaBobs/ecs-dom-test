import { describe, expect, it } from "bun:test";
import { createFormFactory } from "./index.ts";

type Author = {
  name: string;
  age: number;
  books: { title: string; reviewScore: number }[];
  averageReviewScore: number;
};

const AuthorForm = createFormFactory<Author>({
  initialValues: {
    name: "",
    age: 0,
    books: [],
    averageReviewScore: 0,
  },
  validate: {
    name: (v) => (!v ? "Required" : undefined),
    books: {
      _self: (v) => (v.length === 0 ? "At least one book" : undefined),
      reviewScore: (v) => (v < 1 || v > 5 ? "Score 1-5" : undefined),
    },
  },
  computed: {
    averageReviewScore: (data) =>
      data.books.length === 0
        ? 0
        : data.books.reduce((sum, b) => sum + b.reviewScore, 0) / data.books.length,
  },
});

describe("forms", () => {
  it("creates instances with typed accessors", () => {
    const form = AuthorForm.create();
    form.fields.name.set("Alice");
    form.fields.age.set(32);

    expect(form.fields.name.get()).toBe("Alice");
    expect(form.fields.age.get()).toBe(32);
  });

  it("tracks dirty and touched state", () => {
    const form = AuthorForm.create();
    expect(form.isDirty).toBe(false);

    form.fields.name.set("Bob");
    expect(form.isDirty).toBe(true);
    expect(form.fields.name.touched).toBe(true);
  });

  it("supports array operations with stable keys", () => {
    const form = AuthorForm.create();
    form.fields.books.append({ title: "A", reviewScore: 4 });
    form.fields.books.append({ title: "B", reviewScore: 5 });

    const first = form.fields.books.at(0);
    const second = form.fields.books.at(1);
    const firstKey = first.key;

    form.fields.books.move(0, 1);
    const moved = form.fields.books.at(1);

    expect(moved.key).toBe(firstKey);
    expect(moved.title.get()).toBe("A");
    expect(second.index).toBe(1);
  });

  it("validates fields and submit marks touched", () => {
    const form = AuthorForm.create();

    const result = form.submit();
    expect(result.ok).toBe(false);
    expect(form.fields.name.touched).toBe(true);

    form.fields.name.set("Chris");
    form.fields.books.append({ title: "C", reviewScore: 3 });

    const result2 = form.submit();
    expect(result2.ok).toBe(true);
  });

  it("prevents setting computed fields", () => {
    const form = AuthorForm.create();
    expect(() => {
      form.fields.averageReviewScore.set(10);
    }).toThrow();
  });
});
