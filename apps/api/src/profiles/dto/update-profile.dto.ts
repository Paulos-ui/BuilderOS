import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(39) // GitHub's own username length limit
  githubUsername?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chains?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;
}
