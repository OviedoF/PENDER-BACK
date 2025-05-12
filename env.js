import * as url from 'url';

export default {
    __dirname: url.fileURLToPath(new URL('.', import.meta.url)),
}