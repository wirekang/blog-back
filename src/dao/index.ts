import {
  CommentModel, InfoModel, LinkModel, PostModel, TagModel,
} from 'dao/models';
import * as I from 'interfaces';
import { inject, injectable } from 'inversify';
import {
  Connection, createConnection, DeepPartial, getConnection, Repository,
} from 'typeorm';
import TYPES from 'Types';
import utils from 'utils';
import {
  toComment, toInfo, toPost, toTag,
} from 'dao/convert';

@injectable()
export default class MyDao implements I.Dao {
  @inject(TYPES.Filter) private filter!:I.Filter;

  @inject(TYPES.Converter) private converter!:I.Converter;

  private connection!:Connection;

  private postRepo!:Repository<PostModel>;

  private tagRepo!:Repository<TagModel>;

  private commentRepo!:Repository<CommentModel>;

  private infoRepo!: Repository<InfoModel>;

  private linkRepo!: Repository<LinkModel>;

  private doMap!: Map<I.ActionType, any>;

  private option!:I.DaoOption;

  init(option: I.DaoOption): void {
    this.doMap = new Map();
    this.doMap.set(I.ActionType.CreatePost, this.createPost.bind(this));
    this.doMap.set(I.ActionType.UpdatePost, this.updatePost.bind(this));
    this.doMap.set(I.ActionType.ReadPost, this.readPost.bind(this));
    this.doMap.set(I.ActionType.ReadPostMarkdown, this.readPostMarkdown.bind(this));
    this.doMap.set(I.ActionType.ReadPosts, this.readPosts.bind(this));
    this.doMap.set(I.ActionType.DeletePost, this.deletePost.bind(this));
    this.doMap.set(I.ActionType.PublishPost, this.publishPost.bind(this));
    this.doMap.set(I.ActionType.CountPosts, this.countPosts.bind(this));
    this.doMap.set(I.ActionType.CreateComment, this.createComment.bind(this));
    this.doMap.set(I.ActionType.UpdateComment, this.updateComment.bind(this));
    this.doMap.set(I.ActionType.ReadComments, this.readComments.bind(this));
    this.doMap.set(I.ActionType.DeleteComment, this.deleteComment.bind(this));
    this.doMap.set(I.ActionType.ReadTags, this.readTags.bind(this));
    this.doMap.set(I.ActionType.UpdateInfo, this.updateInfo.bind(this));
    this.doMap.set(I.ActionType.ReadInfo, this.readInfo.bind(this));
    this.option = option;
  }

  private getDo(type:I.ActionType): any {
    return this.doMap.get(type);
  }

  async connect(): Promise<void> {
    await createConnection({
      type: 'mariadb',
      ...this.option,
      entities: [PostModel, TagModel, CommentModel, InfoModel, LinkModel],
    });
    this.connection = getConnection();
    await this.connection.synchronize(process.env.DROP_DB === 'true');
    this.postRepo = this.connection.getRepository(PostModel);
    this.tagRepo = this.connection.getRepository(TagModel);
    this.commentRepo = this.connection.getRepository(CommentModel);
    this.infoRepo = this.connection.getRepository(InfoModel);
    this.linkRepo = this.connection.getRepository(LinkModel);
    utils.log('DBConnect');
  }

  async close(): Promise<void> {
    await this.connection.close();
    utils.log('DBClose');
  }

  do<A extends I.Action<I.ActionType, unknown, unknown>>(
    type: A['type'], input: A['input'], admin: boolean,
  ): Promise<A['output']> {
    return this.getDo(type)(input, admin);
  }

  private async updateInfo(input:I.UpdateInfoInput): Promise<I.UpdateInfoOutput> {
    await this.infoRepo.save({
      id: 0,
      description: input.description,
      href: input.href,
      title: input.title,
    });
    const ps = [] as Promise<LinkModel>[];
    input.links.forEach((link) => {
      ps.push(this.linkRepo.save({
        infoId: 0,
        href: link.href,
        name: link.name,
      }));
    });
    await Promise.all(ps);
  }

  private async readInfo(input:I.ReadInfoInput): Promise<I.ReadInfoOutput> {
    const im = await this.infoRepo.findOneOrFail(0, { relations: ['links'] });

    return {
      info: toInfo(im),
    };
  }

  private async validateTags(tagNames: string[]):Promise<TagModel[]> {
    const result = [] as TagModel[];
    const recursive = async (i:number) => {
      const name = tagNames[i];
      if (name) {
        let tm = await this.tagRepo.findOne({ where: { name } });
        if (!tm) {
          tm = new TagModel();
          tm.name = name;
          tm = await this.tagRepo.save(tm);
        }
        result.push(tm);
        await recursive(i + 1);
      }
    };
    await recursive(0);
    return result;
  }

  private async createPost(input: I.CreatePostInput): Promise<I.CreatePostOutput> {
    const tags = await this.validateTags(input.tagNames);
    const post = await this.postRepo.save({
      title: input.title,
      description: input.description,
      html: this.converter.toHtml(input.markdown),
      markdown: input.markdown,
      tags,
      whenCreated: Date.now(),
      whenPublished: Date.now() * 2,
    });
    return { id: post.id };
  }

  private async updatePost(input: I.UpdatePostInput): Promise<I.UpdatePostOutput> {
    const count = await this.postRepo.count({ id: input.id });
    if (!count) {
      throw Error();
    }
    const pm:DeepPartial<PostModel> = new PostModel();
    pm.id = input.id;
    pm.tags = input.tagNames && await this.validateTags(input.tagNames);
    pm.markdown = input.markdown;
    pm.html = input.markdown ? this.converter.toHtml(input.markdown) : undefined;
    pm.description = input.description;
    pm.title = input.title;
    pm.whenUpdated = Date.now();
    await this.postRepo.save(pm);
  }

  private async publishPost(input: I.PublishPostInput): Promise<I.PublishPostOutput> {
    await this.postRepo.save({
      id: input.id,
      published: input.published,
      whenPublished: Date.now() * (input.published ? 1 : 2),
    });
  }

  private selectPostTag(admin:boolean, tagId?: number) {
    return this.postRepo.createQueryBuilder('post')
      .select(
        [
          'post.id',
          'post.title',
          'post.description',
          'post.whenUpdated',
          'post.whenCreated',
          'post.whenPublished',
          'post.published',
          'post.html'],
      )
      .leftJoinAndSelect('post.tags', 'tag')
      .where(tagId ? 'tag.id = :tagId' : 'true', tagId ? { tagId } : {})
      .andWhere(admin ? 'true' : 'post.published = 1');
  }

  private async readPost(input:I.ReadPostInput, admin: boolean)
  : Promise<I.ReadPostOutput> {
    const pm = await this.selectPostTag(admin)
      .andWhere('post.id = :id', { id: input.id })
      .leftJoinAndSelect('post.comments', 'comment')
      .getOneOrFail();
    return { post: toPost(pm) };
  }

  private async readPostMarkdown(input: I.ReadPostMarkdownInput)
  : Promise<I.ReadPostMarkdownOutput> {
    const post = await this.postRepo.findOne(input.id, {
      select: ['markdown'],
    });
    if (!post) {
      throw Error();
    }
    return { markdown: post.markdown };
  }

  private async countPosts(input:I.CountPostsInput, admin: boolean)
  : Promise<I.CountPostsOutput> {
    const postsCount = await this.selectPostTag(admin, input.tagId).getCount();
    return { postsCount };
  }

  private async readPosts(input:I.ReadPostsInput, admin: boolean)
  : Promise<I.ReadPostsOutput> {
    const { tagId } = input;
    const pms = await this.postRepo.createQueryBuilder('post')
      .select(
        [
          'post.id',
          'post.title',
          'post.description',
          'post.whenPublished',
        ],
      )
      .leftJoinAndSelect('post.tags', 'tag')
      .where(tagId ? 'tag.id = :tagId' : 'true', tagId ? { tagId } : {})
      .andWhere(admin ? 'true' : 'post.published = 1')
      .skip(input.offset)
      .take(input.count)
      .getMany();

    const raws = await this.commentRepo.createQueryBuilder('cmt')
      .select('cmt.postId')
      .addSelect('count(cmt.postId)', 'count')
      .groupBy('cmt.postId')
      .getRawMany();
    const postSummaries = await pms.map((pm) => ({
      id: pm.id,
      title: pm.title,
      description: pm.description,
      tags: pm.tags.map((t) => toTag(t)),
      whenPublished: pm.whenPublished,
      commentsCount: Number(raws.find(
        (raw) => raw.cmt_postId === pm.id,
      )?.count || 0),
    }));
    return { postSummaries };
  }

  private async deletePost(input: I.DeletePostInput): Promise<I.DeletePostOutput> {
    const post = await this.postRepo.findOne(input.id);
    if (!post) {
      throw Error();
    }
    await this.postRepo.remove(post);
  }

  private async createComment(input: I.CreateCommentInput, admin: boolean)
  : Promise<I.CreateCommentOutput> {
    const comment = await this.commentRepo.save({
      name: admin ? '-' : this.filter.commentName(input.name),
      password: admin ? '-' : input.password,
      admin,
      text: this.filter.html(input.text),
      postId: input.postId,
      parentId: input.parentId,
      whenCreated: Date.now(),
    });
    return { id: comment.id };
  }

  private async updateComment(input: I.UpdateCommentInput, admin: boolean)
  : Promise<I.UpdateCommentOutput> {
    const cm = await this.commentRepo.findOne(input.id, {
      select: ['admin', 'password'],
    });
    if (!cm) {
      throw Error();
    }
    if (admin !== cm.admin) {
      throw Error();
    }
    if (!admin && cm.password !== input.password) {
      throw Error();
    }
    await this.commentRepo.save({
      id: input.id,
      text: this.filter.html(input.text),
      updated: true,
      whenUpdated: Date.now(),
    });
  }

  private async readComments(input:I.ReadCommentsInput): Promise<I.ReadCommentsOutput> {
    const cms = await this.commentRepo.find(
      { where: { postId: input.postId }, order: { whenCreated: 'ASC' } },
    );
    return { comments: cms.map((cm) => toComment(cm)) };
  }

  private async deleteComment(input:I.DeleteCommentInput, admin: boolean)
  : Promise<I.DeleteCommentOutput> {
    const cm = await this.commentRepo.findOne(input.id,
      { select: ['id', 'password', 'admin'] });
    if (!cm) {
      throw Error();
    }
    if (admin !== cm.admin) {
      throw Error();
    }
    if (!admin && cm.password !== input.password) {
      throw Error();
    }
    await this.commentRepo.remove(cm);
  }

  private async readTags(input:I.ReadTagsInput): Promise<I.ReadTagsOutput> {
    const tms = await this.tagRepo.find();
    return { tags: tms.map((tm) => toTag(tm)) };
  }
}
