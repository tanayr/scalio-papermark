// Bounded, per-process throttling for the single self-hosted instance.
const buckets=new Map<string,{count:number;expires:number}>();
export function permit(key:string,limit=10,windowMs=3600000){
 const now=Date.now();
 if(buckets.size>10000)for(const [k,v]of buckets)if(v.expires<now)buckets.delete(k);
 const bucket=buckets.get(key);
 if(!bucket || bucket.expires<now){if(buckets.size>10000)return false;buckets.set(key,{count:1,expires:now+windowMs});return true;}
 return ++bucket.count<=limit;
}
