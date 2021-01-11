import Config from 'Config';
import { Auth, AuthOption } from 'interfaces';
import { injectable } from 'inversify';
import utils from 'utils';

@injectable()
export default class MyAuth implements Auth {
  private option!:AuthOption;

  init(option: AuthOption): void {
    this.option = option;
  }

  private hash!: string;

  private when!: number;

  // eslint-disable-next-line class-methods-use-this
  makeHash(id:string, pw:string):string {
    return utils.makeHash(id + pw);
  }

  login(id: string, pw: string): string {
    if (this.option.hash === this.makeHash(id, pw)) {
      this.when = Date.now();
      this.hash = utils.makeHash(this.option.hash + this.when.toString(10));
      utils.log('AuthLogin', `id:${id}`);
      return this.hash;
    }
    throw Error();
  }

  validate(hash: string): void {
    if (!this.hash || !this.when) {
      utils.log('AuthValidateEmpty');
      throw Error();
    }

    if (Date.now() - this.when > this.option.maxAge) {
      utils.log('AuthValidateAge');
      throw Error();
    }
    if (this.hash !== hash) {
      utils.log('AuthValidateWrong');
      throw Error();
    }
    utils.log('AuthSuccess');
  }

  isLogin(hash: string): boolean {
    try {
      this.validate(hash);
      utils.log('AuthSuccess');
      return true;
    } catch (e) {
      utils.log('AuthFail');
      return false;
    }
  }

  logout(hash: string): void {
    this.validate(hash);
    this.hash = '';
    utils.log('AuthLogout');
  }
}
