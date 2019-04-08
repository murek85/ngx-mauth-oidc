import { Injectable } from '@angular/core';
import { HttpParameterCodec } from '@angular/common/http';

// see: https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_.22Unicode_Problem.22
export function b64DecodeUnicode(str) {
    const base64 = str.replace(/\-/g, '+').replace(/\_/g, '/');

    return decodeURIComponent(
        atob(base64)
            .split('')
            .map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join('')
    );
}

export class WebHttpUrlEncodingCodec implements HttpParameterCodec {
    encodeKey(
        k: string): string {

        return encodeURIComponent(k);
    }

    encodeValue(
        v: string): string {

        return encodeURIComponent(v);
    }

    decodeKey(
        k: string): string {

        return decodeURIComponent(k);
    }

    decodeValue(
        v: string) {

        return decodeURIComponent(v);
    }
}

@Injectable()
export class NgxMAuthOidcHelperService {
    public padBase64(
        base64data): string {

        while (base64data.length % 4 !== 0) {
            base64data += '=';
        }
        return base64data;
    }

    public calculatePopupFeatures(
        options: { height?: number, width?: number }) {

        // Specify an static height and width and calculate centered position
        const height = options.height || 470;
        const width = options.width || 500;
        const left = (screen.width / 2) - (width / 2);
        const top = (screen.height / 2) - (height / 2);
        return `location=no,toolbar=no,width=${width},height=${height},top=${top},left=${left}`;
    }

    public getSearchFragmentParams(): object {
        let search = location.search;
        search = decodeURIComponent(search);
        if (search.indexOf('?') !== 0) {
            return {};
        }

        return this.getFragmentParams(search, '?');
    }

    public getHashFragmentParams(
        customHashFragment?: string): object {

        let hash = customHashFragment || location.hash;
        hash = decodeURIComponent(hash);
        if (hash.indexOf('#') !== 0) {
            return {};
        }

        return this.getFragmentParams(hash, '#');
    }

    public parseQueryString(
        queryString: string): object {

        const data = {};
        let pairs, pair, separatorIndex, escapedKey, escapedValue, key, value;

        if (queryString === null) {
            return data;
        }

        pairs = queryString.split('&');

        for (let i = 0; i < pairs.length; i++) {
            pair = pairs[i];
            separatorIndex = pair.indexOf('=');

            if (separatorIndex === -1) {
                escapedKey = pair;
                escapedValue = null;
            } else {
                escapedKey = pair.substr(0, separatorIndex);
                escapedValue = pair.substr(separatorIndex + 1);
            }

            key = decodeURIComponent(escapedKey);
            value = decodeURIComponent(escapedValue);

            if (key.substr(0, 1) === '/') { key = key.substr(1); }

            data[key] = value;
        }

        return data;
    }

    public isSearchFragmentParams(): boolean {
        let search = location.search;
        search = decodeURIComponent(search);
        if (search.indexOf('?') !== 0) {
            return false;
        }
        return true;
    }

    public isHashFragmentParams(
        customHashFragment?: string): boolean {

        let hash = customHashFragment || location.hash;
        hash = decodeURIComponent(hash);
        if (hash.indexOf('#') !== 0) {
            return false;
        }
        return true;
    }

    private getFragmentParams(
        query: string,
        mark: string) {

        const questionMarkPosition = query.indexOf(mark);
        if (questionMarkPosition > -1) {
            query = query.substr(questionMarkPosition + 1);
        } else {
            query = query.substr(1);
        }

        return this.parseQueryString(query);
    }
}
