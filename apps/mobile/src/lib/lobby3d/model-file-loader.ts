// 3D 모델 파일을 읽는 방법을 바꾼다. r3f 네이티브는 불러올 때 THREE.FileLoader를 자기 것으로 바꿔 두는데,
// 파일 전체를 base64 문자열로 읽어 JS에서 다시 바이트로 바꾸느라 출시 빌드에서도 로비 모델 셋에 2초 넘게 JS를 막는다.
// 여기서는 파일의 바이트를 바로 읽는다(File.bytes, 파일 하나에 수 ms). 파일 위치를 찾는 방법은 r3f와 같다.
// r3f 네이티브가 먼저 바꿔 둔 뒤에 덮어써야 하므로 그 모듈을 먼저 불러온다.
import "@react-three/fiber/native";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import * as LegacyFS from "expo-file-system/legacy";
import { Platform } from "react-native";
import * as THREE from "three";

type Load = THREE.FileLoader["load"];

// 번들 모듈(require 번호)과 file: 주소만 직접 읽는다. 그 밖의 주소(data:, blob:, 외부 주소)는 r3f의 방법을 그대로 쓴다.
function readsDirectly(url: unknown): url is number | string {
  return typeof url === "number" || (typeof url === "string" && url.startsWith("file:"));
}

async function localUri(input: number | string): Promise<string> {
  if (typeof input === "string") return input;
  const asset = await Asset.fromModule(input).downloadAsync();
  let uri = asset.localUri || asset.uri;
  // 안드로이드 출시 빌드는 모델이 앱 안의 자원이라 경로가 없으니 캐시 폴더로 꺼내 쓴다(r3f와 같은 이름)
  if (!uri.includes(":")) {
    const file = `${LegacyFS.cacheDirectory}ExponentAsset-${asset.hash}.${asset.type}`;
    await LegacyFS.copyAsync({ from: uri, to: file });
    uri = file;
  }
  return uri;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = bytes;
  if (byteOffset === 0 && byteLength === buffer.byteLength) return buffer as ArrayBuffer;
  return buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer;
}

if (Platform.OS !== "web") {
  const fallback = THREE.FileLoader.prototype.load;
  THREE.FileLoader.prototype.load = function load(this: THREE.FileLoader, input, onLoad, onProgress, onError) {
    const url: unknown = this.path && typeof input === "string" ? this.path + input : input;
    if (!readsDirectly(url)) return fallback.call(this, input, onLoad, onProgress, onError);
    this.manager.itemStart(url as string);
    localUri(url)
      .then(async (uri) => {
        const bytes = await new File(uri).bytes();
        onLoad?.(toArrayBuffer(bytes));
      })
      .catch((error: unknown) => {
        onError?.(error);
        this.manager.itemError(url as string);
      })
      .finally(() => {
        this.manager.itemEnd(url as string);
      });
  } as Load;
}

export {};
