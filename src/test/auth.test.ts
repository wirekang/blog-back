import 'reflect-metadata';
import MyAuth from 'auth';
import Config from 'Config';
import { Auth } from 'interfaces';

describe('Auth', () => {
  Config.parse('.config.test.json');
  const auth:Auth = new MyAuth();
  let hash = '';
  it('해시', () => {
    console.log((auth as MyAuth).makeHash('id', 'pw'));
  });
  it('로그인', () => {
    hash = auth.login('id', 'pw');
    expect(auth.isLogin(hash)).toBeTruthy();
    auth.validate(hash);
  });
  it('잘못된 인증', () => {
    expect(auth.isLogin('w2ewwerasdfasdvw2ewfsscxv')).toBeFalsy();
    expect(auth.validate.bind(null, 'asdfqwerksdfj')).toThrowError();
  });
  it('수명 확인', async () => {
    await new Promise<void>((r) => setTimeout(() => r(), 1000));
    expect(auth.validate.bind(null, hash)).toThrowError();
  });
});
