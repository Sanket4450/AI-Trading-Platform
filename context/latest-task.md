## Implementation Plan

Task: Find out the columns to be removed

### Description

- Scan each table and identify columns that are no longer needed or redundant.
  - Either two or more columns can be merged into one.
  - Either one column is completely unnecessary and can be removed.
  - Some columns might be needed for historical purposes but are no longer used in the current implementation.
  - Either column is redundant and the value can be computed from other columns.
  - A column has not business usecase and can be removed.

### Context

- 

### Constraints

- List down each table and the columns that are to be removed.