import crypto from 'crypto';
import Ignore from 'Ignore';

export default {

  makeLog(head:string): (arg0: string)=>void {
    return (str:string) => (console.log(`[${head}] ${str}`));
  },

  getHash(str:string): string {
    return crypto.createHash('sha1').update(str).digest('hex');
  },

  getSHash(str:string): string {
    return crypto.createHmac('sha256', Ignore.secret).update(str).digest('hex');
  },
};
