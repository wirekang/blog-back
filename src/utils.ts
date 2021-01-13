export default {
  log(title:string, data?:string):void {
    const date = new Date();
    console.log(`${date.toLocaleString(undefined, { hour12: false })}\t${title}\t${data || ''}`);
  },
  repeat(fn: ()=>void, time: number):void {
    [...new Array(time)].forEach(() => { fn(); });
  },
  wait(ms: number):Promise<void> {
    return new Promise<void>((r) => { setTimeout(() => r(), ms); });
  },
};
