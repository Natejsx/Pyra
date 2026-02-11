# Dev Server Documentation

## Dev server request handler 

When you run `pyra dev` in any directory, the dev server will look for an index.html file. The router is built from scanning src/routes. If that directory doesn't exist, the scanner returns zero routes, so this.router.match('/') returns null and falls through. 