export function createDefaultStorage() {
    return typeof sessionStorage !== undefined ? sessionStorage : null;
}
