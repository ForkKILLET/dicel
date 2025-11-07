# Todo

## Now

- (.) infix enhancements
  - (v) custom operators
  - (v) fixity parsing
  - (.) custom fixity (bind to symbol)
  - (v) sections
  - ( ) back quotes

- (.) modules
  - (v) top level definitions
  - (v) declarations
  - (.) import
    - (v) import values
    - (v) import types & fixities
    - ( ) qualified import
  - (v) prelude
  - (v) module dep resolution
  - ( ) export (visibility) control
  - ( ) open namespace (qualified module, record, etc.)

- (v) check kind
  - (v) check data defs

- (v) char & string

- (v) records
  - (v) record def
  - (v) record lit
  - (v) record pattern
  - (v) record update

- ( ) parser optimizations
  - ( ) lexer
  - ( ) better error messages
  - ( ) better performance

- ( ) type classes
  - (v) class def & instance def
    - (v) check instance methods
      - (v) name check (missing & extra)
      - (v) type check
      - (v) context check
    - (v) check class head
  - (v) constr collecting
  - (v) constr solving
  - (.) instance resolving
    - ( ) overlapping instances
  - (v) evidence collecting
  - (.) class desugaring (dict passing)
  - ( ) super classes
  - ( ) default methods

---

## Future

- ( ) type synonyms

- ( ) guards

- ( ) list comprehension

- ( ) effect system

- ( ) lazy

- ( ) compile to ...
  - ( ) LLVM IR
  - ( ) WASM

---

## History

- (v) refa Expr.show
- (x) unary operators
- (v) auto semi => layout
- (v) patterns at params & bindings
- (v) lambda case
- (v) custom ADT
- (v) dicel IR => Node Stage
- (v) comment

- (v) binding groups
  - (v) equations
  - (v) func head
  - (v) binding host
