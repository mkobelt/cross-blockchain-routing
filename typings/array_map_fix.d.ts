/*
 * Calling Array.map on tuples is not well supported https://github.com/microsoft/TypeScript/issues/29841
 * Fix source: https://stackoverflow.com/a/57913509
 */ 
interface Array<T> {
    map<U>(
        callbackfn: (value: T, index: number, array: T[]) => U,
        thisArg?: any,
    ): { [K in keyof this]: U }
}
