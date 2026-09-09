import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
type Scope={caveId:string;connectionId:string;purpose:string};
export class CredentialCipher {
 readonly key:Buffer;readonly version:string;
 constructor(key:string,version='v1'){if(!/^[a-f0-9]{64}$/i.test(key)||!/^[a-zA-Z0-9_-]{1,40}$/.test(version))throw new Error('Invalid credential encryption configuration');this.key=Buffer.from(key,'hex');this.version=version;}
 private aad(scope:Scope){return Buffer.from(JSON.stringify(['encave-connector',this.version,scope.caveId,scope.connectionId,scope.purpose]));}
 seal(value:object,scope:Scope){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(this.aad(scope));const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return this.version+'.'+Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64url');}
 open<T>(value:string,scope:Scope):T{const parts=value.split('.');if(parts.length!==2||parts[0]!==this.version||!parts[1]||parts[1].length>4_000_000)throw new Error('Invalid encrypted credential');const bytes=Buffer.from(parts[1],'base64url');if(bytes.length<29)throw new Error('Invalid encrypted credential');const decipher=createDecipheriv('aes-256-gcm',this.key,bytes.subarray(0,12));decipher.setAAD(this.aad(scope));decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8')) as T;}
}
